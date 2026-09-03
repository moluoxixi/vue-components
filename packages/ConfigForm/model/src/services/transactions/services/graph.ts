import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { NodeId, NodeSubgraph, NodeTarget, PageGraph, PageId, PageNode, ProjectDocument, ProjectNodeChange, ProjectNodeRelation, SlotItem } from '../../../types'
import type { NodeLocation } from '../types'
import { invalid } from '../errors'
import { nodeRelation } from './changes'

export function collectSubtreeIds(graph: PageGraph, rootId: NodeId, target = new Set<NodeId>()): Set<NodeId> {
  if (target.has(rootId))
    return target
  target.add(rootId)
  const node = graph.nodesById[rootId]
  if (!node)
    return target
  if (node.kind === 'layout')
    Object.values(node.slots).forEach(items => items.forEach(item => collectSubtreeIds(graph, item.nodeId, target)))
  return target
}

export function collectInsertedNodeChanges(
  pageId: PageId,
  subgraph: NodeSubgraph,
  target: NodeTarget,
): ProjectNodeChange[] {
  const changes: ProjectNodeChange[] = []
  const visit = (nodeId: NodeId, relation: ProjectNodeRelation): void => {
    changes.push({ kind: 'insert', pageId, nodeId, after: relation })
    const node = subgraph.nodesById[nodeId]
    if (!node || node.kind !== 'layout')
      return
    Object.entries(node.slots).forEach(([slot, children]) => {
      children.forEach(child => visit(child.nodeId, nodeRelation(nodeId, slot)))
    })
  }
  subgraph.root.forEach(item => visit(item.nodeId, nodeRelation(target.parentId, target.slot)))
  return changes
}

export function collectRemovedNodeChanges(
  pageId: PageId,
  graph: PageGraph,
  rootId: NodeId,
  rootLocation: NodeLocation,
): ProjectNodeChange[] {
  const changes: ProjectNodeChange[] = []
  const visit = (nodeId: NodeId, relation: ProjectNodeRelation): void => {
    changes.push({ kind: 'remove', pageId, nodeId, before: relation })
    const node = graph.nodesById[nodeId]
    if (!node || node.kind !== 'layout')
      return
    Object.entries(node.slots).forEach(([slot, children]) => {
      children.forEach(child => visit(child.nodeId, nodeRelation(nodeId, slot)))
    })
  }
  visit(rootId, nodeRelation(rootLocation.parentId, rootLocation.slot))
  return changes
}

export function flowTargetChanges(
  pageId: PageId,
  before: ConfigFormFlow | undefined,
  after: ConfigFormFlow | undefined,
): ProjectNodeChange[] {
  const nodeIds = new Set<NodeId>()
  if (before?.trigger.kind === 'component.event' && before.trigger.nodeId)
    nodeIds.add(before.trigger.nodeId)
  if (after?.trigger.kind === 'component.event' && after.trigger.nodeId)
    nodeIds.add(after.trigger.nodeId)
  return [...nodeIds].map(nodeId => ({ kind: 'content', pageId, nodeId }))
}

export function assertInsertedFieldNamesUnique(
  graph: PageGraph,
  subgraph: NodeSubgraph,
  pageId: PageId,
): void {
  const existingFields = new Set(
    Object.values(graph.nodesById)
      .filter(node => node.kind === 'field')
      .map(node => node.field),
  )
  for (const node of Object.values(subgraph.nodesById)) {
    if (node.kind !== 'field')
      continue
    if (existingFields.has(node.field))
      invalid('PROJECT_FIELD_DUPLICATE', `Field name must be unique: ${node.field}`, pageId, node.id)
    existingFields.add(node.field)
  }
}

export function findNodeLocation(graph: PageGraph, nodeId: NodeId): NodeLocation | undefined {
  const rootIndex = graph.root.findIndex(item => item.nodeId === nodeId)
  if (rootIndex >= 0)
    return { parentId: null, sequence: graph.root, item: graph.root[rootIndex]!, index: rootIndex }
  for (const node of Object.values(graph.nodesById)) {
    if (node.kind !== 'layout')
      continue
    for (const [slot, sequence] of Object.entries(node.slots)) {
      const index = sequence.findIndex(item => item.nodeId === nodeId)
      if (index >= 0)
        return { parentId: node.id, slot, sequence, item: sequence[index]!, index }
    }
  }
  return undefined
}

export function requireNodeLocation(graph: PageGraph, nodeId: NodeId, pageId: PageId): NodeLocation {
  const location = findNodeLocation(graph, nodeId)
  if (!location)
    invalid('PROJECT_NODE_LOCATION_UNKNOWN', `Node has no parent location: ${nodeId}`, pageId, nodeId)
  return location
}

export function resolveTargetSequence(graph: PageGraph, target: NodeTarget): SlotItem[] {
  if (target.parentId === null) {
    if (target.slot)
      invalid('PROJECT_ROOT_SLOT_INVALID', 'Root node targets cannot specify a slot.')
    return graph.root
  }
  if (!Object.hasOwn(graph.nodesById, target.parentId))
    invalid('PROJECT_TARGET_PARENT_UNKNOWN', `Target parent does not exist: ${target.parentId}`, undefined, target.parentId)
  const parent = graph.nodesById[target.parentId]!
  if (parent.kind !== 'layout')
    invalid('PROJECT_TARGET_PARENT_INVALID', `Target parent is not a layout: ${target.parentId}`, undefined, target.parentId)
  const slot = target.slot ?? 'default'
  assertSafeRecordKey(slot, 'PROJECT_TARGET_SLOT_INVALID')
  return parent.slots[slot] ??= []
}

export function requirePage(document: ProjectDocument, pageId: PageId) {
  if (!Object.hasOwn(document.pagesById, pageId))
    invalid('PROJECT_PAGE_UNKNOWN', `Page does not exist: ${pageId}`, pageId)
  return document.pagesById[pageId]!
}

export function requireNode(document: ProjectDocument, pageId: PageId, nodeId: NodeId): PageNode {
  const page = requirePage(document, pageId)
  if (!Object.hasOwn(page.graph.nodesById, nodeId))
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}`, pageId, nodeId)
  return page.graph.nodesById[nodeId]!
}

export function assertInsertIndex(index: number, length: number, code: string): void {
  if (!Number.isInteger(index) || index < 0 || index > length)
    invalid(code, `Insert index ${index} is outside 0..${length}.`)
}

export function assertSafeRecordKey(key: string, code: string): void {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype')
    invalid(code, `Record key is not allowed: ${key}.`)
}
