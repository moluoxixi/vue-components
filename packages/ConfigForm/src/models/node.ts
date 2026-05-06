import type {
  DefinedFormNodeConfig,
  FieldConfig,
  FormNodeConfig,
  ResolvedComponentNode,
  ResolvedField,
  ResolvedFormNode,
  SlotContent,
} from '@/types'
import { isVNode } from 'vue'
import { CONFIG_FORM_DEFINED_NODE } from '@/types'

const CONFIG_FORM_RESOLVED_NODE = Symbol.for('moluoxixi.config-form.resolved-node')

/**
 * 判断未知值是否可按普通对象读取。
 *
 * 该守卫仅排除空值和数组，VNode 等更具体的边界由上层节点判断负责。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** 判断未知值是否是 ConfigForm 节点声明。 */
export function isFormNodeConfig(value: unknown): value is FormNodeConfig {
  return Boolean(
    isRecord(value)
    && !isVNode(value)
    && 'component' in value,
  )
}

/** 判断节点是否是真实字段节点，即是否绑定了表单值 key。 */
export function isFieldConfig(value: unknown): value is FieldConfig {
  return Boolean(
    isFormNodeConfig(value)
    && typeof (value as { field?: unknown }).field === 'string',
  )
}

/** 给节点配置写入不可枚举的 defineField(...) brand。 */
export function markDefinedFormNodeConfig<TConfig extends FormNodeConfig>(
  value: TConfig,
): DefinedFormNodeConfig<TConfig> {
  Object.defineProperty(value, CONFIG_FORM_DEFINED_NODE, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  })

  return value as DefinedFormNodeConfig<TConfig>
}

/** 判断节点配置是否由 defineField(...) 创建。 */
export function isDefinedFormNodeConfig(value: unknown): value is DefinedFormNodeConfig {
  return Boolean(
    isFormNodeConfig(value)
    && (value as { [CONFIG_FORM_DEFINED_NODE]?: unknown })[CONFIG_FORM_DEFINED_NODE] === true,
  )
}

/** 给运行时已解析节点同时写入 defineField 和 resolved-node brand。 */
export function markResolvedFormNodeConfig<TConfig extends ResolvedFormNode>(
  value: TConfig,
): TConfig {
  const defined = markDefinedFormNodeConfig(value as TConfig & FormNodeConfig)

  if ((defined as unknown as Record<symbol, unknown>)[CONFIG_FORM_RESOLVED_NODE] !== true) {
    Object.defineProperty(defined, CONFIG_FORM_RESOLVED_NODE, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    })
  }

  return defined as TConfig
}

/** 判断节点是否已经由 FormRuntime 解析过。 */
export function isResolvedFormNodeConfig(value: unknown): value is ResolvedFormNode {
  return Boolean(
    isFormNodeConfig(value)
    && (value as unknown as Record<symbol, unknown>)[CONFIG_FORM_RESOLVED_NODE] === true,
  )
}

/** 判断已解析节点是否同时是真实字段节点。 */
export function isResolvedFieldConfig(value: unknown): value is ResolvedField {
  return isResolvedFormNodeConfig(value) && isFieldConfig(value)
}

/** 已解析节点：有 field 绑定 + 有 label → Field 类型。 */
export function isResolvedField(value: ResolvedFormNode): value is ResolvedField {
  return isFieldConfig(value) && (value as ResolvedField).label != null
}

/** 已解析节点：有 field 绑定 + 无 label → Component 类型。 */
export function isResolvedComponent(value: ResolvedFormNode): value is ResolvedField {
  return isFieldConfig(value) && (value as ResolvedField).label == null
}

/** 已解析节点：无 field 绑定 → Container 类型。 */
export function isResolvedContainer(value: ResolvedFormNode): value is ResolvedComponentNode {
  return !isFieldConfig(value)
}

/**
 * 从 slot 内容中收集真实字段节点。
 *
 * 函数 slot 只执行一层静态解析；若返回函数则视为运行时渲染内容，不提前推断字段拓扑。
 */
function collectSlotFields(slot: SlotContent | undefined, path = 'slot'): FieldConfig[] {
  if (slot == null || slot === false)
    return []

  if (typeof slot === 'function') {
    const resolved = slot(undefined)
    return typeof resolved === 'function'
      ? []
      : collectSlotFields(resolved, path)
  }

  if (Array.isArray(slot))
    return slot.flatMap((item, index) => collectSlotFields(item as SlotContent, `${path}.${index}`))

  if (!isFormNodeConfig(slot))
    return []

  return collectFieldConfigsRaw([slot])
}

/**
 * 递归收集节点树中的真实字段配置。
 *
 * 该函数只负责拓扑遍历和容器字段边界校验，重复 field key 由外层统一处理。
 */
function collectFieldConfigsRaw(nodes: readonly FormNodeConfig[]): FieldConfig[] {
  return nodes.flatMap((node) => {
    const nested = Object.entries(node.slots ?? {}).flatMap(([key, slot]) => collectSlotFields(slot, `${nodePath(node)}.slots.${key}`))
    return isFieldConfig(node) ? [node, ...nested] : nested
  })
}

/** 多个真实字段绑定同一个表单值 key 时直接抛错。 */
export function assertUniqueFieldConfigs<TField extends Pick<FieldConfig, 'field'>>(
  fields: readonly TField[],
): TField[] {
  const seen = new Set<string>()

  for (const field of fields) {
    if (seen.has(field.field))
      throw new Error(`Duplicate field key: ${field.field}`)

    seen.add(field.field)
  }

  return [...fields]
}

/**
 * 从混合节点树中收集真实字段配置，包含 slot 子节点。
 *
 * 容器节点会继续向下遍历，但自身不拥有值、校验和提交行为，因此不会返回。
 */
export function collectFieldConfigs(nodes: readonly FormNodeConfig[]): FieldConfig[] {
  return assertUniqueFieldConfigs(collectFieldConfigsRaw(nodes))
}

/**
 * 生成节点错误定位路径。
 *
 * 字段节点使用 field 作为稳定路径，容器节点使用通用名称避免伪造不存在的字段 key。
 */
function nodePath(node: FormNodeConfig): string {
  return isFieldConfig(node) ? node.field : 'component node'
}
