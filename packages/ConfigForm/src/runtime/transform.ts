import type { VNode } from 'vue'
import type { ComponentRegistry, FormFieldTransform, FormRuntimePlugin } from './types'
import type { FieldDefaultConfig } from '@/plugins/builtInFieldDefaults'
import type { FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, SlotContent } from '@/types'
import { isVNode } from 'vue'
import { applyFieldDefaults, resolveField } from '@/plugins/builtInFieldDefaults'
import { isFormNodeConfig } from '@/utils/node'
import { hasFieldBinding } from './utils'

export interface FieldPipelineContext {
  resolveField: (field: FormNodeConfig) => FieldDefaultConfig
  transformField: (field: FormNodeConfig) => NormalizedNodeConfig
}

type PlainRecord = Record<string, unknown>

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
  function transformSlot(slot: SlotContent, path: string): SlotContent {
    if (Array.isArray(slot))
      return slot.map((item, index) => transformSlotNode(item, `${path}[${index}]`)) as SlotContent

    return transformSlotNode(slot, path)
  }

  /** 转换单个 slot 节点配置；遇到非配置值时直接抛错，避免旧 render slot 语义继续生效。 */
  function transformSlotNode(value: unknown, path: string): NormalizedNodeConfig {
    if (!isTransformableNode(value))
      throw new TypeError(`Slot "${path}" must be a field config or an array of field configs`)

    return transformField(value)
  }

  /** 对单个字段执行完整转换管线。 */
  function transformField(field: FormNodeConfig): NormalizedNodeConfig {
    const userField = field
    let current = applyFieldDefaults(field)

    for (const hook of hooks) {
      const next = hook.handler(cloneFieldForPlugin(current))
      if (next === undefined)
        continue
      if (!next || typeof next !== 'object' || Array.isArray(next))
        throw new TypeError(`Plugin ${hook.pluginName} transformField must return a field object or undefined`)
      if (hasFieldBinding(current) && hasFieldBinding(next) && next.field !== (current as NormalizedFieldConfig).field) {
        throw new Error(
          `Plugin ${hook.pluginName} cannot change field key from "${(current as NormalizedFieldConfig).field}" to "${(next as NormalizedFieldConfig).field}"`,
        )
      }
      current = mergePluginField(current, next as FormNodeConfig, userField)
    }

    const resolved = applyFieldDefaults({
      ...current,
      component: resolveComponent(current.component),
      slots: current.slots
        ? Object.fromEntries(
            Object.entries(current.slots).map(([name, slot]) => [name, transformSlot(slot, name)]),
          )
        : current.slots,
    } as FormNodeConfig)

    return resolved
  }

  return { resolveField, transformField }
}

/** 无插件场景下的便捷转换函数。 */
export function transformField(field: FormNodeConfig): NormalizedNodeConfig {
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
function cloneFieldForPlugin(field: NormalizedNodeConfig): NormalizedNodeConfig {
  return {
    ...field,
    props: { ...field.props },
    slots: field.slots ? { ...field.slots } : field.slots,
  }
}

/** 合并插件返回值，并恢复用户显式声明的字段值优先级。 */
function mergePluginField(
  current: NormalizedNodeConfig,
  pluginField: FormNodeConfig,
  userField: FormNodeConfig,
): NormalizedNodeConfig {
  const pluginResolved = applyFieldDefaults({
    ...current,
    ...pluginField,
    props: mergeRecords(current.props, pluginField.props ?? {}),
  } as FormNodeConfig)

  return restoreUserPriority(pluginResolved, userField)
}

/** 将用户显式声明的顶层字段和 props 恢复到最高优先级。 */
function restoreUserPriority(
  field: NormalizedNodeConfig,
  userField: FormNodeConfig,
): NormalizedNodeConfig {
  const restored = { ...field } as NormalizedNodeConfig & PlainRecord

  for (const [key, value] of Object.entries(userField)) {
    if (key === 'props') {
      restored.props = mergeRecords(restored.props, value as PlainRecord)
      continue
    }
    if (key === 'slots') {
      restored.slots = value as NormalizedNodeConfig['slots']
      continue
    }
    restored[key] = value
  }

  return applyFieldDefaults(restored as FormNodeConfig)
}

/** 深合并普通对象；右侧对象优先，数组、VNode 和组件对象保持整体替换。 */
function mergeRecords(...sources: PlainRecord[]): PlainRecord {
  const result: PlainRecord = {}
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      const previous = result[key]
      result[key] = isPlainRecord(previous) && isPlainRecord(value)
        ? mergeRecords(previous, value)
        : value
    }
  }
  return result
}

/** 判断值是否可安全作为普通对象递归合并。 */
function isPlainRecord(value: unknown): value is PlainRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  if (isVNode(value as VNode))
    return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** 判断 slot 值是否是需要继续递归转换的表单节点。 */
function isTransformableNode(value: unknown): value is FormNodeConfig {
  return isFormNodeConfig(value)
}
