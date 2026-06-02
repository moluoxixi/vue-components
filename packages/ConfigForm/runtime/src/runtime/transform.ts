import type {
  ComponentRegistry,
  FormFieldDefault,
  FormFieldDefaultConfig,
  FormFieldTransform,
  FormRuntimePlugin,
} from './types'
import type {
  DefinedFormNodeConfig,
  FormNodeConfig,
  NormalizedFieldConfig,
  NormalizedNodeConfig,
  RenderFunction,
  ResolvedFormNode,
  ResolvedSlotContent,
  ResolvedSlotContentItem,
  SlotContent,
} from '@/types'
import type { PlainRecord } from '@/utils/object'
import { ConfigFormError } from '@/errors'
import { applyFieldDefaults, BUILT_IN_FIELD_DEFAULTS_PLUGIN } from '@/plugins/builtInFieldDefaults'
import { isFormNodeConfig } from '@/utils/node'
import { cloneRecordWithChildren, mergeRecords, readPlainRecord } from '@/utils/object'
import { hasFieldBinding } from './utils'

export interface FieldPipelineContext {
  getFieldDefaults: (field: FormNodeConfig) => FormFieldDefaultConfig
  transformField: (field: FormNodeConfig) => ResolvedFormNode
}

type PipelineNode = NormalizedFieldConfig | NormalizedNodeConfig
type PluginField = DefinedFormNodeConfig | NormalizedNodeConfig
const FORBIDDEN_DEFAULT_FIELD_KEYS = new Set(['component', 'field', 'slots'])
const PLUGIN_CLONE_CHILD_KEYS = ['props', 'slots']
const HTML_TAG_NAME_RE = /^[a-z][a-z0-9-]*$/

/** 创建字段配置管线，负责默认值、插件、用户优先级、组件解析和 slot 递归编排。 */
export function createFieldPipeline(
  components: ComponentRegistry = {},
  plugins: FormRuntimePlugin[] = [],
): FieldPipelineContext {
  const defaultHooks = collectDefaultHooks(plugins)
  const transformHooks = collectTransformHooks(plugins)

  /**
   * 将字段里的字符串组件 key 解析成真实组件。
   *
   * 这里不再处理“谁能覆盖谁”的注册冲突，那件事已经在 createFormRuntime() 组装注册表时完成；
   * 当前阶段只负责消费最终注册表，并对未知组件 key 直接报错。
   */
  function resolveComponent(component: NormalizedNodeConfig['component']): NormalizedNodeConfig['component'] {
    if (typeof component !== 'string')
      return component

    if (Object.hasOwn(components, component))
      return components[component]

    if (HTML_TAG_NAME_RE.test(component))
      return component

    throw new ConfigFormError(
      'CONFIG_FORM_UNKNOWN_COMPONENT_KEY',
      `Unknown component key: ${component}`,
      { component },
    )
  }

  /** 收集内置和用户插件的默认字段片段；右侧片段在对象合并时具备更高优先级。 */
  function getFieldDefaults(field: FormNodeConfig): FormFieldDefaultConfig {
    const fragments = defaultHooks.map(hook => resolveDefaultField(hook, field))
    return mergeRecords(...fragments) as FormFieldDefaultConfig
  }

  /** 递归处理 slot 节点配置，确保子节点在进入渲染组件前已完成转换。 */
  function transformSlot(slot: SlotContent, path: string): ResolvedSlotContent {
    if (Array.isArray(slot))
      return slot.map((item, index) => transformSlotNode(item, `${path}[${index}]`))

    return transformSlotNode(slot, path)
  }

  /** 转换单个 slot 节点配置；render 函数作为叶子保留，不参与字段拓扑转换。 */
  function transformSlotNode(value: unknown, path: string): ResolvedSlotContentItem {
    if (typeof value === 'function')
      return value as RenderFunction

    if (!isFormNodeConfig(value)) {
      throw new ConfigFormError(
        'CONFIG_FORM_INVALID_SLOT_NODE',
        `Slot "${path}" must be a field config, render function, or an array of them`,
        { path },
      )
    }

    return transformField(value)
  }

  /** 对单个字段执行完整转换管线。 */
  function transformField(field: FormNodeConfig): ResolvedFormNode {
    let current = applyFieldDefaults(
      mergeRecords(getFieldDefaults(field), field) as unknown as FormNodeConfig,
    ) as PipelineNode

    for (const hook of transformHooks)
      current = runTransformHook(hook, current)

    return resolveFinalField(restoreUserFieldPriority(current, field))
  }

  /** 执行单个 transformField hook，并在继续后续 hook 前重新规范化字段。 */
  function runTransformHook(hook: RuntimeHook, current: PipelineNode): PipelineNode {
    const next = hook.handler(cloneFieldForPlugin(current))
    if (next === undefined)
      return current
    if (!isFormNodeConfig(next)) {
      throw new ConfigFormError(
        'CONFIG_FORM_INVALID_TRANSFORM_FIELD',
        `Plugin ${hook.pluginName} transformField must return a field object or undefined`,
        { pluginName: hook.pluginName },
      )
    }

    assertFieldKeyStable(hook.pluginName, current, next)

    return applyFieldDefaults(next) as PipelineNode
  }

  /**
   * transformField 可以补充或派生字段配置，但用户显式声明始终是最高优先级。
   *
   * 这里在所有 transform hook 结束后恢复用户片段，既让插件能读取已合并输入，
   * 又避免插件覆盖调用方直接写在字段上的绑定、props 和拓扑声明。
   */
  function restoreUserFieldPriority(current: PipelineNode, field: FormNodeConfig): PipelineNode {
    return applyFieldDefaults(
      mergeRecords(current, field) as unknown as FormNodeConfig,
    ) as PipelineNode
  }

  /** 解析组件和 slot，产出渲染层可直接消费的最终节点。 */
  function resolveFinalField(field: PipelineNode): ResolvedFormNode {
    return applyFieldDefaults<ResolvedSlotContent>({
      ...field,
      component: resolveComponent(field.component),
      slots: field.slots
        ? Object.fromEntries(
            Object.entries(field.slots).map(([name, slot]) => [name, transformSlot(slot, name)]),
          )
        : field.slots,
    }) as ResolvedFormNode
  }

  return { getFieldDefaults, transformField }
}

/** 无插件场景下的便捷转换函数。 */
export function transformField(field: FormNodeConfig): ResolvedFormNode {
  return createFieldPipeline().transformField(field)
}

interface DefaultHook {
  handler: FormFieldDefault
  pluginName: string
}

interface RuntimeHook {
  handler: FormFieldTransform
  pluginName: string
}

/** 收集内置默认值插件和用户插件的 getDefaultField hook，内置插件始终优先级最低。 */
function collectDefaultHooks(plugins: FormRuntimePlugin[]): DefaultHook[] {
  const sources: Array<{
    getDefaultField?: FormFieldDefault
    name: string
  }> = [BUILT_IN_FIELD_DEFAULTS_PLUGIN, ...plugins]

  return sources
    .filter((plugin): plugin is { getDefaultField: FormFieldDefault, name: string } => typeof plugin.getDefaultField === 'function')
    .map(plugin => ({
      handler: plugin.getDefaultField,
      pluginName: plugin.name,
    }))
}

/** 收集插件 transformField hook，并按插件注册顺序执行。 */
function collectTransformHooks(plugins: FormRuntimePlugin[]): RuntimeHook[] {
  return plugins
    .filter((plugin): plugin is FormRuntimePlugin & { transformField: FormFieldTransform } => typeof plugin.transformField === 'function')
    .map(plugin => ({
      handler: plugin.transformField,
      pluginName: plugin.name,
    }))
}

/** 执行默认值 hook 并校验其返回普通对象片段，避免非法默认值被静默跳过。 */
function resolveDefaultField(hook: DefaultHook, field: FormNodeConfig): FormFieldDefaultConfig | undefined {
  const defaults = hook.handler(cloneRecordWithChildren(field, PLUGIN_CLONE_CHILD_KEYS))
  if (defaults === undefined)
    return undefined

  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    throw new ConfigFormError(
      'CONFIG_FORM_INVALID_DEFAULT_FIELD',
      `Plugin ${hook.pluginName} getDefaultField must return a field object or undefined`,
      { pluginName: hook.pluginName },
    )
  }

  const record = readPlainRecord(defaults, `Plugin ${hook.pluginName} getDefaultField return`)
  assertDefaultFieldKeys(hook.pluginName, record)

  return record as FormFieldDefaultConfig
}

/** 校验默认值 hook 不能返回会改变节点身份或子树拓扑的字段。 */
function assertDefaultFieldKeys(pluginName: string, defaults: PlainRecord): void {
  for (const key of Object.keys(defaults)) {
    if (FORBIDDEN_DEFAULT_FIELD_KEYS.has(key)) {
      throw new ConfigFormError(
        'CONFIG_FORM_FORBIDDEN_DEFAULT_FIELD_KEY',
        `Plugin ${pluginName} getDefaultField cannot return "${key}"`,
        { key, pluginName },
      )
    }
  }
}

/** 为转换插件提供浅复制字段，避免插件直接修改当前管线状态。 */
function cloneFieldForPlugin(field: PipelineNode): PipelineNode {
  return cloneRecordWithChildren(field, PLUGIN_CLONE_CHILD_KEYS)
}

/** 校验转换插件不能移除或改写已有字段 key，避免表单值拓扑被插件隐式重写。 */
function assertFieldKeyStable(
  pluginName: string,
  current: PipelineNode,
  next: PluginField,
): void {
  if (!hasFieldBinding(current))
    return

  if (!hasFieldBinding(next)) {
    throw new ConfigFormError(
      'CONFIG_FORM_REMOVED_FIELD_KEY',
      `Plugin ${pluginName} cannot remove field key "${current.field}"`,
      { field: current.field, pluginName },
    )
  }

  if (next.field !== current.field) {
    throw new ConfigFormError(
      'CONFIG_FORM_CHANGED_FIELD_KEY',
      `Plugin ${pluginName} cannot change field key from "${current.field}" to "${next.field}"`,
      {
        field: current.field,
        nextField: next.field,
        pluginName,
      },
    )
  }
}
