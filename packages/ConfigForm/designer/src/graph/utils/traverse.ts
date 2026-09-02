import type { ModelJsonValue, PageGraph, PageNode, SlotItem } from '@moluoxixi/config-form-model'
import type { DesignerJsonObject, DesignerJsonValue, DesignNodeLocation, DesignNodeVisit } from '../types'

function visitSequence(
  graph: PageGraph,
  sequence: SlotItem[],
  visitor: (visit: DesignNodeVisit) => void,
  path: Array<string | number>,
  parent?: Extract<PageNode, { kind: 'layout' }>,
  slot?: string,
): void {
  sequence.forEach((item, index) => {
    const node = graph.nodesById[item.nodeId]
    if (!node)
      return
    const nodePath = [...path, index]
    visitor({
      index,
      item,
      node,
      parent,
      parentId: parent?.id ?? null,
      path: nodePath,
      placement: item.placement,
      ...(slot ? { slot } : {}),
    })
    if (node.kind === 'layout') {
      Object.entries(node.slots).forEach(([childSlot, children]) => {
        visitSequence(graph, children, visitor, [...nodePath, 'slots', childSlot], node, childSlot)
      })
    }
  })
}

export function walkDesignGraph(graph: PageGraph, visitor: (visit: DesignNodeVisit) => void): void {
  visitSequence(graph, graph.root, visitor, ['root'])
}

export function findDesignNode(graph: PageGraph, nodeId: string): DesignNodeLocation | undefined {
  let found: DesignNodeLocation | undefined
  const search = (
    sequence: SlotItem[],
    path: Array<string | number>,
    parent?: Extract<PageNode, { kind: 'layout' }>,
    slot?: string,
  ): void => {
    if (found)
      return
    sequence.forEach((item, index) => {
      if (found)
        return
      const node = graph.nodesById[item.nodeId]
      if (!node)
        return
      const nodePath = [...path, index]
      if (node.id === nodeId) {
        found = {
          index,
          item,
          node,
          parent,
          parentId: parent?.id ?? null,
          path: nodePath,
          placement: item.placement,
          sequence,
          ...(slot ? { slot } : {}),
        }
        return
      }
      if (node.kind === 'layout') {
        Object.entries(node.slots).forEach(([childSlot, children]) => {
          search(children, [...nodePath, 'slots', childSlot], node, childSlot)
        })
      }
    })
  }
  search(graph.root, ['root'])
  return found
}

export function collectDesignSubtreeIds(graph: PageGraph, nodeId: string): Set<string> {
  const ids = new Set<string>()
  const visit = (currentId: string): void => {
    if (ids.has(currentId))
      return
    ids.add(currentId)
    const node = graph.nodesById[currentId]
    if (node?.kind === 'layout')
      Object.values(node.slots).forEach(items => items.forEach(item => visit(item.nodeId)))
  }
  visit(nodeId)
  return ids
}

export function isDesignerJsonObject(value: unknown): value is DesignerJsonObject {
  return isDesignerJsonValue(value)
    && !Array.isArray(value)
    && typeof value === 'object'
    && value !== null
}

export function isDesignerJsonValue(value: unknown): value is DesignerJsonValue {
  try {
    structuredClone(value as ModelJsonValue)
    return isJsonValue(value, new WeakSet())
  }
  catch {
    return false
  }
}

function isJsonValue(value: unknown, ancestors: WeakSet<object>): value is DesignerJsonValue {
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
  const valid = (Array.isArray(value) ? value : Object.values(value)).every(item => isJsonValue(item, ancestors))
  ancestors.delete(value)
  return valid
}

export function cloneDesignerJsonValue<T extends DesignerJsonValue>(value: T): T {
  return structuredClone(value)
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
  return leftKeys.length === Object.keys(rightRecord).length
    && leftKeys.every(key => Object.hasOwn(rightRecord, key)
      && areDesignerJsonValuesEqual(leftRecord[key], rightRecord[key]))
}
