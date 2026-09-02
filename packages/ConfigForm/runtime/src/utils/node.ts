import type {
  FieldConfig,
  FormNodeConfig,
  ResolvedComponentField,
  ResolvedComponentNode,
  ResolvedField,
  ResolvedFormNode,
  ResolvedSlotContent,
  SlotContent,
} from '../types'
import { isVNode } from 'vue'
import { ConfigFormError } from '../errors'

type TraversableFormNode = FormNodeConfig | ResolvedFormNode
type TraversableSlotContent = SlotContent | ResolvedSlotContent

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

/** 判断已解析节点是否同时是真实字段节点。 */
export function isResolvedFieldConfig(value: unknown): value is ResolvedField | ResolvedComponentField {
  return isFieldConfig(value)
}

/** 已解析节点：有 field 绑定 + 有 label → Field 类型；id 不参与分类。 */
export function isResolvedField(value: ResolvedFormNode): value is ResolvedField {
  return isFieldConfig(value) && typeof value.label === 'string'
}

/** 已解析节点：有 field 绑定 + 无 label → Component 类型；id 不改变节点语义。 */
export function isResolvedComponent(value: ResolvedFormNode): value is ResolvedComponentField {
  return isFieldConfig(value) && !isResolvedField(value)
}

/** 已解析节点：无 field 绑定 → Container 类型。 */
export function isResolvedContainer(value: ResolvedFormNode): value is ResolvedComponentNode {
  return !isFieldConfig(value)
}

/**
 * 从 slot 节点配置中收集真实字段节点。
 *
 * slot 与顶层 fields 采用同一种声明模式；非节点配置会直接抛错，避免字段拓扑被静默漏收。
 */
function collectSlotFields(
  slot: TraversableSlotContent | undefined,
  fields: FieldConfig[],
  path = 'slot',
): void {
  if (slot === undefined)
    return

  if (Array.isArray(slot)) {
    slot.forEach((item, index) => collectSlotFields(item, fields, `${path}.${index}`))
    return
  }

  if (typeof slot === 'function')
    return

  if (!isFormNodeConfig(slot)) {
    throw new ConfigFormError(
      'CONFIG_FORM_INVALID_SLOT_NODE',
      `Slot "${path}" must be a field config, render function, or an array of them`,
      { path },
    )
  }

  collectNodeFields(slot, fields)
}

/** 以前序顺序把单个节点及其 slot 字段写入共享结果数组。 */
function collectNodeFields(node: TraversableFormNode, fields: FieldConfig[]): void {
  if (isFieldConfig(node))
    fields.push(node)

  Object.entries(node.slots ?? {}).forEach(([key, slot]) => {
    collectSlotFields(slot, fields, `${nodePath(node)}.slots.${key}`)
  })
}

/**
 * 递归收集节点树中的真实字段配置。
 *
 * 该函数只负责拓扑遍历和容器字段边界校验，重复 field key 由外层统一处理。
 */
function collectFieldConfigsRaw(nodes: readonly TraversableFormNode[]): FieldConfig[] {
  const fields: FieldConfig[] = []
  nodes.forEach(node => collectNodeFields(node, fields))
  return fields
}

/** 多个真实字段绑定同一个表单值 key 时直接抛错。 */
export function assertUniqueFieldConfigs<TField extends Pick<FieldConfig, 'field'>>(
  fields: readonly TField[],
): TField[] {
  const seen = new Set<string>()

  for (const field of fields) {
    if (seen.has(field.field)) {
      throw new ConfigFormError(
        'CONFIG_FORM_DUPLICATE_FIELD_KEY',
        `Duplicate field key: ${field.field}`,
        { field: field.field },
      )
    }

    seen.add(field.field)
  }

  return [...fields]
}

/**
 * 从混合节点树中收集真实字段配置，包含 slot 子节点。
 *
 * 容器节点会继续向下遍历，但自身不拥有值、校验和提交行为，因此不会返回。
 */
export function collectFieldConfigs(nodes: readonly TraversableFormNode[]): FieldConfig[] {
  return assertUniqueFieldConfigs(collectFieldConfigsRaw(nodes))
}

/**
 * 生成节点错误定位路径。
 *
 * 字段节点使用 field 作为稳定路径；容器节点优先使用 id，再使用组件标识，
 * 避免大型字段树里出现无法区分的通用错误路径。
 */
function nodePath(node: FormNodeConfig): string {
  if (isFieldConfig(node))
    return node.field

  if (node.id)
    return `component#${node.id}`

  if (typeof node.component === 'string')
    return `component:${node.component}`

  const componentName = (node.component as { name?: unknown }).name
  if (typeof componentName === 'string' && componentName)
    return `component:${componentName}`

  return 'component node'
}
