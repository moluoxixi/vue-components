import type { DesignerDocument, DesignerJsonValue, DesignerNode } from './types'

export interface DesignerNodeVisit {
  node: DesignerNode
  path: (string | number)[]
  parent?: DesignerNode
  slot?: string
  index: number
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
