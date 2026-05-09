import type { ComponentRegistry, FormFieldTransform, FormRuntimePlugin } from './types'
import type { FieldDefaultConfig } from '@/plugins/builtInFieldDefaults'
import type { DefinedFormNodeConfig, FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, ResolvedFormNode, ResolvedSlotContent, SlotContent } from '@/types'
import type { PlainRecord } from '@/utils/object'
import { applyFieldDefaults, getFieldDefaults } from '@/plugins/builtInFieldDefaults'
import { isFormNodeConfig } from '@/utils/node'
import { mergeRecords, readPlainRecord } from '@/utils/object'
import { readFormItemProps } from './formItem'
import { hasFieldBinding } from './utils'

export interface FieldPipelineContext {
  getFieldDefaults: (field: FormNodeConfig) => FieldDefaultConfig
  transformField: (field: FormNodeConfig) => ResolvedFormNode
}

type PipelineNode = NormalizedFieldConfig | NormalizedNodeConfig
type PluginField = DefinedFormNodeConfig | NormalizedNodeConfig

/** 创建字段配置管线，负责默认值、插件、用户优先级、组件解析和 slot 递归编排。 */
export function createFieldPipeline(
  components: ComponentRegistry = {},
  plugins: FormRuntimePlugin[] = [],
): FieldPipelineContext {
  const hooks = collectHooks(plugins)

  /** 将字符串组件 key 转换为注册组件，缺失的大写 key 直接抛错。 */
  function resolveComponent(component: NormalizedNodeConfig['component']): NormalizedNodeConfig['component'] {
    if (typeof component === 'string' && Object.hasOwn(components, component))
      return components[component]
    if (typeof component === 'string' && /^[A-Z]/.test(component))
      throw new Error(`Unknown component key: ${component}`)
    return component
  }

  /** 递归处理 slot 节点配置，确保子节点在进入渲染组件前已完成转换。 */
  function transformSlot(slot: SlotContent, path: string): ResolvedSlotContent {
    if (Array.isArray(slot))
      return slot.map((item, index) => transformSlotNode(item, `${path}[${index}]`))

    return transformSlotNode(slot, path)
  }

  /** 转换单个 slot 节点配置；遇到非配置值时直接抛错，避免旧 render slot 语义继续生效。 */
  function transformSlotNode(value: unknown, path: string): ResolvedFormNode {
    if (!isFormNodeConfig(value))
      throw new TypeError(`Slot "${path}" must be a field config or an array of field configs`)

    return transformField(value)
  }

  /** 对单个字段执行完整转换管线。 */
  function transformField(field: FormNodeConfig): ResolvedFormNode {
    const userField = field
    let current: PipelineNode = applyFieldDefaults(field)

    for (const hook of hooks) {
      const next = hook.handler(cloneFieldForPlugin(current))
      if (next === undefined)
        continue
      if (!next || typeof next !== 'object' || Array.isArray(next))
        throw new TypeError(`Plugin ${hook.pluginName} transformField must return a field object or undefined`)
      if (hasFieldBinding(current) && hasFieldBinding(next) && next.field !== current.field) {
        throw new Error(
          `Plugin ${hook.pluginName} cannot change field key from "${current.field}" to "${next.field}"`,
        )
      }
      current = mergePluginField(current, next, userField)
    }

    const resolved = applyFieldDefaults<ResolvedSlotContent>({
      ...current,
      component: resolveComponent(current.component),
      slots: current.slots
        ? Object.fromEntries(
            Object.entries(current.slots).map(([name, slot]) => [name, transformSlot(slot, name)]),
          )
        : current.slots,
    })

    return resolved
  }

  return { getFieldDefaults, transformField }
}

/** 无插件场景下的便捷转换函数。 */
export function transformField(field: FormNodeConfig): ResolvedFormNode {
  return createFieldPipeline().transformField(field)
}

interface RuntimeHook {
  handler: FormFieldTransform
  pluginName: string
}

/** 收集插件 transformField hook，并按插件注册顺序执行。 */
function collectHooks(plugins: FormRuntimePlugin[]): RuntimeHook[] {
  return plugins
    .filter((plugin): plugin is FormRuntimePlugin & { transformField: FormFieldTransform } => typeof plugin.transformField === 'function')
    .map(plugin => ({
      handler: plugin.transformField,
      pluginName: plugin.name,
    }))
}

/** 为插件提供浅复制字段，避免插件直接修改当前管线状态。 */
function cloneFieldForPlugin(field: PipelineNode): PipelineNode {
  const clone: PipelineNode = {
    ...field,
    props: { ...field.props },
    ...(hasFieldBinding(field) ? { formItemProps: { ...field.formItemProps } } : {}),
    slots: field.slots ? { ...field.slots } : field.slots,
  }

  return clone
}

/** 合并插件返回值，并恢复用户显式声明的字段值优先级。 */
function mergePluginField(
  current: PipelineNode,
  pluginField: PluginField,
  userField: FormNodeConfig,
): PipelineNode {
  const pluginCandidate = {
    ...current,
    ...pluginField,
    ...(hasFieldBinding(current) || hasFormItemProps(pluginField)
      ? {
          formItemProps: mergeRecords(
            readOptionalPlainRecord(readRecordProperty(current, 'formItemProps'), 'formItemProps') ?? {},
            readOptionalPlainRecord(readRecordProperty(pluginField, 'formItemProps'), 'formItemProps') ?? {},
          ),
        }
      : {}),
    props: mergeRecords(current.props, pluginField.props ?? {}),
  }
  const pluginResolved = applyFieldDefaults(
    pluginCandidate,
  )

  return restoreUserPriority(pluginResolved, userField)
}

/** 将用户显式声明的顶层字段和 props 恢复到最高优先级。 */
function restoreUserPriority(
  field: PipelineNode,
  userField: FormNodeConfig,
): PipelineNode {
  const restored = { ...field } as PipelineNode & PlainRecord

  for (const [key, value] of Object.entries(userField)) {
    if (key === 'props') {
      restored.props = mergeRecords(restored.props, readPlainRecord(value, 'props'))
      continue
    }
    if (key === 'formItemProps') {
      if (!hasFieldBinding(restored))
        throw new TypeError('formItemProps can only be used on field nodes')
      restored.formItemProps = mergeRecords(
        readPlainRecord(restored.formItemProps, 'formItemProps'),
        readPlainRecord(value, 'formItemProps'),
      )
      continue
    }
    if (key === 'slots') {
      restored.slots = value as NormalizedNodeConfig['slots']
      continue
    }
    restored[key] = value
  }

  return applyFieldDefaults(restored)
}

/** 安全读取配置对象上的字段，避免为临时类型洞增加断言。 */
function readRecordProperty(source: object, key: string): unknown {
  return Object.hasOwn(source, key) ? Reflect.get(source, key) : undefined
}

/** 判断插件返回值是否显式携带 FormItem 根节点属性。 */
function hasFormItemProps(source: object): boolean {
  return readRecordProperty(source, 'formItemProps') !== undefined
}

/** 读取可选普通对象选项；缺省值保持缺省，由调用方决定默认片段。 */
function readOptionalPlainRecord(value: unknown, optionName: string): PlainRecord | undefined {
  if (value === undefined)
    return undefined

  if (optionName === 'formItemProps')
    return readFormItemProps(value, optionName)

  return readPlainRecord(value, optionName)
}
