import type { FormErrors, FormValues, NormalizedFieldConfig, ResolvedFormNode, ResolvedSlotContent } from '@/types'
import { ConfigFormError } from '@/errors'
import { isFieldConfig, isFormNodeConfig } from '@/utils/node'
import { resolveValue } from '@/utils/resolvable'

/** 字段树的节点拓扑索引。 */
export interface NodeTopology {
  /** 当前字段树中的节点对象集合，用于区分未知外部节点和顶层节点。 */
  nodes: WeakSet<ResolvedFormNode>
  /** 子节点到父节点的关系；顶层节点的父节点为 undefined。 */
  parentMap: WeakMap<ResolvedFormNode, ResolvedFormNode | undefined>
  /** 真实字段名到节点对象的索引，供校验和提交按字段名定位父链。 */
  fieldNodeMap: Map<string, ResolvedFormNode>
}

/** 给一次提交或校验快照预计算的可见性结果。 */
export interface VisibilitySnapshot {
  byField: Map<string, boolean>
  byNode: WeakMap<ResolvedFormNode, boolean>
}

/** 过滤掉不属于当前字段集合的错误，避免已移除字段继续占位。 */
export function filterErrorsByFieldNames(errors: FormErrors, fieldNames: readonly string[]): FormErrors {
  const allowedFields = new Set(fieldNames)
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => allowedFields.has(field)),
  )
}

/**
 * 初始化或重建字段值。
 *
 * 根据当前字段拓扑补全默认值并浅层同步到 reactive 存储。
 * pruneToFields 为 true 时移除不属于当前真实字段拓扑的值，用于字段树变化后的状态收敛。
 */
export function buildNextFormValues(
  source: FormValues,
  fields: readonly Pick<NormalizedFieldConfig, 'defaultValue' | 'field'>[],
  pruneToFields: boolean,
): FormValues {
  const fieldNames = new Set(fields.map(field => field.field))
  const next: FormValues = pruneToFields
    ? Object.fromEntries(Object.entries(source).filter(([key]) => fieldNames.has(key)))
    : { ...source }

  for (const field of fields) {
    if (!Object.hasOwn(next, field.field))
      next[field.field] = field.defaultValue !== undefined ? field.defaultValue : undefined
  }

  return next
}

/** 浅层同步 reactive 存储，只增删改顶层字段，保留 Date、Dayjs 等实例引用。 */
export function syncValueStore(store: FormValues, next: FormValues): void {
  for (const key of Object.keys(store)) {
    if (!Object.hasOwn(next, key))
      delete store[key]
  }

  for (const [key, val] of Object.entries(next)) {
    if (store[key] !== val)
      store[key] = val
  }
}

/** 创建节点拓扑索引；只在字段树结构变化时重建，不依赖实时 values。 */
export function createNodeTopology(nodes: readonly ResolvedFormNode[]): NodeTopology {
  const topology: NodeTopology = {
    fieldNodeMap: new Map<string, ResolvedFormNode>(),
    nodes: new WeakSet<ResolvedFormNode>(),
    parentMap: new WeakMap<ResolvedFormNode, ResolvedFormNode | undefined>(),
  }
  const stack = new Set<ResolvedFormNode>()

  nodes.forEach((node, index) =>
    collectNodeTopology(node, undefined, `fields.${index}`, topology, stack),
  )

  return topology
}

/**
 * 递归记录单个节点的父子关系和真实字段索引。
 *
 * 重复对象引用或重复 field 会让父链和字段语义不唯一，因此直接抛错。
 */
function collectNodeTopology(
  node: ResolvedFormNode,
  parent: ResolvedFormNode | undefined,
  path: string,
  topology: NodeTopology,
  stack: Set<ResolvedFormNode>,
): void {
  if (stack.has(node)) {
    throw new ConfigFormError(
      'CONFIG_FORM_CIRCULAR_FIELD_NODE',
      `Circular field node reference at ${path}`,
      { path },
    )
  }
  if (topology.nodes.has(node)) {
    throw new ConfigFormError(
      'CONFIG_FORM_DUPLICATE_FIELD_NODE',
      `Duplicate field node reference at ${path}`,
      { path },
    )
  }

  stack.add(node)
  topology.nodes.add(node)
  topology.parentMap.set(node, parent)

  if (isFieldConfig(node)) {
    if (topology.fieldNodeMap.has(node.field)) {
      throw new ConfigFormError(
        'CONFIG_FORM_DUPLICATE_FIELD_KEY',
        `Duplicate field key: ${node.field}`,
        { field: node.field },
      )
    }
    topology.fieldNodeMap.set(node.field, node)
  }

  for (const [slotName, slot] of Object.entries(node.slots ?? {}))
    collectSlotTopology(slot, node, `${path}.slots.${slotName}`, topology, stack)

  stack.delete(node)
}

/** 递归记录 slot 内节点的父子关系；slot 协议与顶层 fields 保持一致。 */
function collectSlotTopology(
  slot: ResolvedSlotContent,
  parent: ResolvedFormNode,
  path: string,
  topology: NodeTopology,
  stack: Set<ResolvedFormNode>,
): void {
  if (Array.isArray(slot)) {
    for (const item of slot)
      collectSlotTopology(item, parent, `${path}[]`, topology, stack)
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

  collectNodeTopology(slot, parent, path, topology, stack)
}

/** 为当前 values 快照预计算所有节点可见性，避免提交/校验阶段重复遍历父链。 */
export function createVisibilitySnapshot(values: FormValues, topology: NodeTopology): VisibilitySnapshot {
  const byField = new Map<string, boolean>()
  const byNode = new WeakMap<ResolvedFormNode, boolean>()

  for (const [fieldName, node] of topology.fieldNodeMap.entries()) {
    const visible = resolveNodeVisibility(node, values, topology, byNode)
    byField.set(fieldName, visible)
  }

  return { byField, byNode }
}

/** 沿父链即时解析节点可见性；父节点隐藏时不再执行后代 visible 条件。 */
export function resolveNodeVisibility(
  node: ResolvedFormNode,
  values: FormValues,
  topology: NodeTopology,
  cache?: WeakMap<ResolvedFormNode, boolean>,
): boolean {
  const cached = cache?.get(node)
  if (cached !== undefined)
    return cached

  const parent = topology.parentMap.get(node)
  if (parent && !resolveNodeVisibility(parent, values, topology, cache)) {
    cache?.set(node, false)
    return false
  }

  const visible = resolveValue(node.visible, values, true)
  cache?.set(node, visible)
  return visible
}
