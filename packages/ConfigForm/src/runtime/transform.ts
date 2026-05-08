import type { VNode } from 'vue'
import type { ComponentRegistry, FormFieldTransform, FormRuntimePlugin } from './types'
import type { FormNodeConfig, NormalizedFieldConfig, NormalizedNodeConfig, SlotContent } from '@/types'
import { isVNode } from 'vue'
import { isFormNodeConfig } from '@/utils/node'
import { resolveField } from './normalize'
import { hasFieldBinding } from './utils'

export interface TransformContext {
  resolveField: (field: FormNodeConfig) => NormalizedNodeConfig
  transformField: (field: FormNodeConfig) => NormalizedNodeConfig
  transformFields: (fields: readonly FormNodeConfig[]) => NormalizedNodeConfig[]
}

type PlainRecord = Record<string, unknown>

/** 创建字段转换上下文，负责插件执行、用户优先级合并、组件解析和 slot 递归。 */
export function createTransform(
  components: ComponentRegistry = {},
  plugins: FormRuntimePlugin[] = [],
): TransformContext {
  const hooks = collectHooks(plugins)

  /** 将字符串组件 key 转换为注册组件，缺失的大写 key 直接抛错。 */
  function resolveComponent(component: NormalizedNodeConfig['component']): NormalizedNodeConfig['component'] {
    if (typeof component === 'string' && Object.hasOwn(components, component))
      return components[component]
    if (typeof component === 'string' && /^[A-Z]/.test(component))
      throw new Error(`Unknown component key: ${component}`)
    return component
  }

  /** 递归处理 slot 内容，确保子节点在进入渲染组件前已完成转换。 */
  function transformSlot(slot: SlotContent): SlotContent {
    if (typeof slot === 'function')
      return scope => transformSlot(slot(scope))

    if (Array.isArray(slot))
      return slot.map(item => transformSlot(item as SlotContent)) as SlotContent

    if (isTransformableNode(slot))
      return transformField(slot)

    return slot
  }

  /** 对单个字段执行完整转换管线。 */
  function transformField(field: FormNodeConfig): NormalizedNodeConfig {
    const userField = field
    let current = resolveField(field)

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

    const resolved = resolveField({
      ...current,
      component: resolveComponent(current.component),
      slots: current.slots
        ? Object.fromEntries(
            Object.entries(current.slots).map(([name, slot]) => [name, transformSlot(slot)]),
          )
        : current.slots,
    } as FormNodeConfig)

    return resolved
  }

  /** 批量执行完整转换管线。 */
  function transformFields(fields: readonly FormNodeConfig[]): NormalizedNodeConfig[] {
    return fields.map(field => transformField(field))
  }

  return { resolveField, transformField, transformFields }
}

/** 无插件场景下的便捷转换函数。 */
export function transformField(field: FormNodeConfig): NormalizedNodeConfig {
  return createTransform().transformField(field)
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
  const pluginResolved = resolveField({
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

  return resolveField(restored as FormNodeConfig)
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
