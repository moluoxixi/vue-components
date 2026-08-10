import type { DesignerDocument, DesignerJsonObject, DesignerJsonValue, DesignerNode } from './types'

export interface DesignerNodeVisit {
  node: DesignerNode
  path: (string | number)[]
  parent?: DesignerNode
  slot?: string
  index: number
}

/** Validate a JSON object without accepting class instances or circular references. */
export function isDesignerJsonObject(value: unknown): value is DesignerJsonObject {
  return isDesignerJsonValueInternal(value, new WeakSet<object>())
    && !Array.isArray(value)
    && typeof value === 'object'
    && value !== null
}

/** Validate a JSON value supplied directly through an adapter API. */
export function isDesignerJsonValue(value: unknown): value is DesignerJsonValue {
  return isDesignerJsonValueInternal(value, new WeakSet<object>())
}

function isDesignerJsonValueInternal(value: unknown, ancestors: WeakSet<object>): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number')
    return Number.isFinite(value)
  if (typeof value !== 'object')
    return false

  if (ancestors.has(value))
    return false

  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
      return false
  }

  ancestors.add(value)
  const valid = (Array.isArray(value) ? value : Object.values(value))
    .every(child => isDesignerJsonValueInternal(child, ancestors))
  ancestors.delete(value)
  return valid
}

export function walkDesignerNodes(
  nodes: DesignerNode[],
  visitor: (visit: DesignerNodeVisit) => void,
  path: (string | number)[] = ['nodes'],
  parent?: DesignerNode,
  slot?: string,
): void {
  for (const [index, node] of nodes.entries()) {
    const nodePath = [...path, index]
    visitor({ node, path: nodePath, parent, slot, index })
    if (node.kind !== 'container')
      continue
    for (const [childSlot, children] of Object.entries(node.slots)) {
      walkDesignerNodes(
        children,
        visitor,
        [...nodePath, 'slots', childSlot],
        node,
        childSlot,
      )
    }
  }
}

export function cloneDesignerJsonValue<T extends DesignerJsonValue>(value: T): T {
  if (Array.isArray(value))
    return value.map(item => cloneDesignerJsonValue(item)) as T
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneDesignerJsonValue(item)]),
    ) as T
  }
  return value
}

export function cloneDesignerNode<T extends DesignerNode>(node: T): T {
  const cloned = cloneDesignerJsonValue(node as unknown as DesignerJsonValue) as unknown as DesignerNode
  return cloned as T
}

export function areDesignerJsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areDesignerJsonValuesEqual(value, right[index]))
  }
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null)
    return false

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.hasOwn(rightRecord, key)
      && areDesignerJsonValuesEqual(leftRecord[key], rightRecord[key]))
}

export function cloneDesignerDocument(document: DesignerDocument): DesignerDocument {
  return {
    version: document.version,
    form: { ...document.form },
    nodes: document.nodes.map(cloneDesignerNode),
  }
}
