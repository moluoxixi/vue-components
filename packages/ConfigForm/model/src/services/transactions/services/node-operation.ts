import type { LayoutNode, NodeId, NodeSubgraph, NodeTarget, PageId, PageNode, ProjectDocument, ProjectNodeChange, ProjectOperation } from '../../../types'
import type { OperationResult } from '../types'
import { isDraft, original } from 'immer'
import { modelJsonObjectSchema, nodeSubgraphSchema } from '../../../schemas'
import { ProjectReferenceRewriteError, rewritePageFieldReferences } from '../../reference-integrity'
import { invalid } from '../errors'
import { parseNodeCandidate, requireParsedValue } from '../validation'
import { changed, cloneModelValue, nodeRelation, semanticallyEqual, unchanged } from './changes'
import {
  assertInsertIndex,
  assertPageValueKeysUnique,
  assertSafeRecordKey,
  collectInsertedNodeChanges,
  collectRemovedNodeChanges,
  collectSubtreeIds,
  requireNode,
  requireNodeLocation,
  requirePage,
  resolveTargetSequence,
} from './graph'

type NodeOperation = Extract<ProjectOperation, { type:
  | 'node.bindings'
  | 'node.config.remove'
  | 'node.insert'
  | 'node.move'
  | 'node.placement'
  | 'node.props'
  | 'node.remove'
  | 'node.settings' }>

export function applyNodeOperation(document: ProjectDocument, operation: NodeOperation): OperationResult {
  switch (operation.type) {
    case 'node.insert':
      return insertSubgraph(document, operation.pageId, operation.subgraph, operation.target)
    case 'node.move':
      return moveNode(document, operation.pageId, operation.nodeId, operation.target)
    case 'node.props': {
      const node = requireNode(document, operation.pageId, operation.nodeId)
      const previous = cloneModelValue(node.props)
      const nextNode = parseNodeCandidate({ ...node, props: operation.props }, operation.pageId, node.id)
      if (semanticallyEqual(previous, nextNode.props))
        return unchanged()
      requirePage(document, operation.pageId).graph.nodesById[node.id] = nextNode
      return changed([{ type: 'node.props', pageId: operation.pageId, nodeId: node.id, props: previous }], [operation.pageId], [node.id])
    }
    case 'node.bindings': {
      const node = requireNode(document, operation.pageId, operation.nodeId)
      const previous = cloneModelValue(node.bindings)
      const nextNode = parseNodeCandidate({ ...node, bindings: operation.bindings }, operation.pageId, node.id)
      if (semanticallyEqual(previous, nextNode.bindings))
        return unchanged()
      requirePage(document, operation.pageId).graph.nodesById[node.id] = nextNode
      return changed([{ type: 'node.bindings', pageId: operation.pageId, nodeId: node.id, bindings: previous }], [operation.pageId], [node.id])
    }
    case 'node.config.remove':
      return removeNodeConfig(document, operation)
    case 'node.placement': {
      requireNode(document, operation.pageId, operation.nodeId)
      const page = requirePage(document, operation.pageId)
      const location = requireNodeLocation(page.graph, operation.nodeId, operation.pageId)
      const placement = requireParsedValue(
        modelJsonObjectSchema.safeParse(operation.placement),
        'PROJECT_NODE_PLACEMENT_INVALID',
        'Node placement is invalid.',
        operation.pageId,
        operation.nodeId,
      )
      const previous = cloneModelValue(location.item.placement)
      if (semanticallyEqual(previous, placement))
        return unchanged()
      location.item.placement = placement
      return changed([{ type: 'node.placement', pageId: operation.pageId, nodeId: operation.nodeId, placement: previous }], [operation.pageId], [operation.nodeId])
    }
    case 'node.settings':
      return updateNodeSettings(document, operation)
    case 'node.remove':
      return removeNode(document, operation.pageId, operation.nodeId)
  }
}

function removeNodeConfig(
  document: ProjectDocument,
  operation: Extract<ProjectOperation, { type: 'node.config.remove' }>,
): OperationResult {
  const page = requirePage(document, operation.pageId)
  const node = requireNode(document, operation.pageId, operation.nodeId)

  if (operation.property === 'bindings' || operation.property === 'conditions') {
    const key = operation.key
    if (!key?.trim())
      invalid('PROJECT_NODE_CONFIG_REMOVE_KEY_REQUIRED', `Stored ${operation.property} removal requires a non-empty key.`, page.id, node.id)
    assertSafeRecordKey(key, 'PROJECT_NODE_CONFIG_REMOVE_KEY_INVALID')
    const current = operation.property === 'conditions' ? node.conditions : node[operation.property]
    if (!current || !Object.hasOwn(current, key))
      return unchanged()
    if (operation.property === 'bindings') {
      const previous = cloneModelValue(node.bindings)
      const bindings = cloneModelValue(node.bindings)
      delete bindings[key]
      page.graph.nodesById[node.id] = parseNodeCandidate({ ...node, bindings }, page.id, node.id)
      return changed([{ type: 'node.bindings', pageId: page.id, nodeId: node.id, bindings: previous }], [page.id], [node.id])
    }
    const previous = settingsForNode(node)
    const conditions = cloneModelValue(node.conditions ?? {})
    delete conditions[key as keyof typeof conditions]
    page.graph.nodesById[node.id] = parseNodeCandidate({ ...node, conditions }, page.id, node.id)
    return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [node.id])
  }
  if (operation.key !== undefined)
    invalid('PROJECT_NODE_CONFIG_REMOVE_KEY_UNEXPECTED', `Stored ${operation.property} removal does not accept a nested key.`, page.id, node.id)
  if (operation.property === 'valueScope') {
    if (node.kind !== 'layout')
      invalid('PROJECT_NODE_CONFIG_REMOVE_KIND_INVALID', 'Field nodes do not contain valueScope.', page.id, node.id)
    if (node.valueScope === undefined)
      return unchanged()
    const previous = settingsForNode(node)
    const candidate = { ...node }
    delete candidate.valueScope
    page.graph.nodesById[node.id] = parseNodeCandidate(candidate, page.id, node.id)
    return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [node.id])
  }
  if (operation.property === 'optionSource') {
    if (node.kind !== 'field')
      invalid('PROJECT_NODE_CONFIG_REMOVE_KIND_INVALID', 'Layout nodes do not contain optionSource.', page.id, node.id)
    if (node.optionSource === undefined)
      return unchanged()
    const previous = settingsForNode(node)
    const candidate = { ...node }
    delete candidate.optionSource
    page.graph.nodesById[node.id] = parseNodeCandidate(candidate, page.id, node.id)
    return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [node.id])
  }
  if (node.kind !== 'field')
    invalid('PROJECT_NODE_CONFIG_REMOVE_KIND_INVALID', `Layout nodes do not contain ${operation.property}.`, page.id, node.id)
  if (node[operation.property] === undefined)
    return unchanged()
  const previous = settingsForNode(node)
  const candidate = { ...node }
  delete candidate[operation.property]
  page.graph.nodesById[node.id] = parseNodeCandidate(candidate, page.id, node.id)
  return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [node.id])
}

function insertSubgraph(
  document: ProjectDocument,
  pageId: PageId,
  subgraph: NodeSubgraph,
  target: NodeTarget,
): OperationResult {
  if (subgraph.root.length === 0 && Object.keys(subgraph.nodesById).length === 0)
    return unchanged()
  const page = requirePage(document, pageId)
  const validation = nodeSubgraphSchema.safeParse({
    version: page.graph.version,
    props: {},
    form: {},
    root: subgraph.root,
    nodesById: subgraph.nodesById,
  })
  if (!validation.success)
    invalid('PROJECT_NODE_SUBGRAPH_INVALID', validation.error.issues[0]?.message ?? 'Inserted subgraph is invalid.', pageId)
  const normalizedSubgraph: NodeSubgraph = { root: validation.data.root, nodesById: validation.data.nodesById }
  const conflict = Object.keys(normalizedSubgraph.nodesById).find(nodeId => Object.hasOwn(page.graph.nodesById, nodeId))
  if (conflict)
    invalid('PROJECT_NODE_ID_DUPLICATE', `Node already exists: ${conflict}`, pageId, conflict)
  const sequence = resolveTargetSequence(page.graph, target)
  const index = target.index ?? sequence.length
  assertInsertIndex(index, sequence.length, 'PROJECT_NODE_INDEX_INVALID')
  Object.entries(normalizedSubgraph.nodesById).forEach(([nodeId, node]) => {
    page.graph.nodesById[nodeId] = node
  })
  sequence.splice(index, 0, ...normalizedSubgraph.root)
  assertPageValueKeysUnique(page.graph, pageId)
  const roots = normalizedSubgraph.root.map(item => item.nodeId)
  const nodeChanges = collectInsertedNodeChanges(pageId, normalizedSubgraph, target)
  if (target.parentId)
    nodeChanges.push({ kind: 'content', pageId, nodeId: target.parentId })
  return changed(
    [...roots].reverse().map(nodeId => ({ type: 'node.remove', pageId, nodeId })),
    [pageId],
    Object.keys(normalizedSubgraph.nodesById),
    false,
    nodeChanges,
    pageHasValueScopes(page.graph) || subgraphRequiresPageContentValidation(normalizedSubgraph),
  )
}

function moveNode(document: ProjectDocument, pageId: PageId, nodeId: NodeId, target: NodeTarget): OperationResult {
  const page = requirePage(document, pageId)
  const validatePageContent = pageHasValueScopes(page.graph)
  const location = requireNodeLocation(page.graph, nodeId, pageId)
  if (target.parentId && collectSubtreeIds(page.graph, nodeId).has(target.parentId))
    invalid('PROJECT_NODE_MOVE_CYCLE', 'A node cannot be moved into its own subtree.', pageId, nodeId)
  const previousTarget: NodeTarget = {
    parentId: location.parentId,
    ...(location.slot ? { slot: location.slot } : {}),
    index: location.index,
  }
  const targetSlot = target.parentId === null ? undefined : (target.slot ?? 'default')
  const sameSequence = target.parentId === location.parentId && targetSlot === location.slot
  const targetIndex = target.index ?? (sameSequence ? location.sequence.length - 1 : undefined)
  if (sameSequence && targetIndex === location.index)
    return unchanged()
  location.sequence.splice(location.index, 1)
  const destination = resolveTargetSequence(page.graph, target)
  const index = target.index ?? destination.length
  assertInsertIndex(index, destination.length, 'PROJECT_NODE_INDEX_INVALID')
  destination.splice(index, 0, location.item)
  if (validatePageContent)
    assertPageValueKeysUnique(page.graph, pageId)
  const nodeChanges: ProjectNodeChange[] = [{
    kind: 'move',
    pageId,
    nodeId,
    before: nodeRelation(location.parentId, location.slot),
    after: nodeRelation(target.parentId, targetSlot),
  }]
  for (const parentId of new Set([location.parentId, target.parentId])) {
    if (parentId)
      nodeChanges.push({ kind: 'content', pageId, nodeId: parentId })
  }
  return changed(
    [{ type: 'node.move', pageId, nodeId, target: previousTarget }],
    [pageId],
    [nodeId],
    false,
    nodeChanges,
    validatePageContent,
  )
}

function updateNodeSettings(
  document: ProjectDocument,
  operation: Extract<ProjectOperation, { type: 'node.settings' }>,
): OperationResult {
  const page = requirePage(document, operation.pageId)
  const node = requireNode(document, operation.pageId, operation.nodeId)
  if (node.kind !== operation.settings.kind)
    invalid('PROJECT_NODE_KIND_CHANGE_INVALID', 'Node settings cannot change a node kind.', operation.pageId, operation.nodeId)
  const previous = settingsForNode(node)
  if (semanticallyEqual(previous, operation.settings))
    return unchanged()
  const common = {
    id: node.id,
    component: operation.settings.component,
    props: node.props,
    bindings: node.bindings,
    ...(operation.settings.extensions ? { extensions: cloneModelValue(operation.settings.extensions) } : {}),
    ...(operation.settings.conditions ? { conditions: cloneModelValue(operation.settings.conditions) } : {}),
    ...(operation.settings.reactions ? { reactions: cloneModelValue(operation.settings.reactions) } : {}),
  }
  const nextNode = operation.settings.kind === 'layout'
    ? {
        ...common,
        kind: 'layout' as const,
        slots: (node as LayoutNode).slots,
        ...(operation.settings.valueScope ? { valueScope: cloneModelValue(operation.settings.valueScope) } : {}),
      }
    : {
        ...common,
        kind: 'field' as const,
        field: operation.settings.field,
        ...(operation.settings.label !== undefined ? { label: operation.settings.label } : {}),
        ...(operation.settings.defaultValue !== undefined ? { defaultValue: cloneModelValue(operation.settings.defaultValue) } : {}),
        ...(operation.settings.validation !== undefined ? { validation: cloneModelValue(operation.settings.validation) } : {}),
        ...(operation.settings.validateOn !== undefined ? { validateOn: cloneModelValue(operation.settings.validateOn) } : {}),
        ...(operation.settings.optionSource !== undefined ? { optionSource: cloneModelValue(operation.settings.optionSource) } : {}),
      }
  const parsedNode = parseNodeCandidate(nextNode, page.id, node.id)
  const changedNodeIds = new Set<NodeId>([node.id])
  if (node.kind === 'field' && parsedNode.kind === 'field' && node.field !== parsedNode.field) {
    try {
      rewritePageFieldReferences(page, node.id, node.field, parsedNode.field, parsedNode)
        .forEach(id => changedNodeIds.add(id))
    }
    catch (error) {
      if (error instanceof ProjectReferenceRewriteError)
        invalid(error.code, error.message, page.id, node.id)
      throw error
    }
  }
  page.graph.nodesById[node.id] = parsedNode
  return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [...changedNodeIds])
}

function removeNode(document: ProjectDocument, pageId: PageId, nodeId: NodeId): OperationResult {
  const page = requirePage(document, pageId)
  const location = requireNodeLocation(page.graph, nodeId, pageId)
  const subtreeIds = collectSubtreeIds(page.graph, nodeId)
  const nodeChanges = collectRemovedNodeChanges(pageId, page.graph, nodeId, location)
  if (location.parentId)
    nodeChanges.push({ kind: 'content', pageId, nodeId: location.parentId })
  const nodesById: NodeSubgraph['nodesById'] = Object.create(null)
  subtreeIds.forEach((descendantId) => {
    nodesById[descendantId] = cloneModelValue(page.graph.nodesById[descendantId]!)
    delete page.graph.nodesById[descendantId]
  })
  location.sequence.splice(location.index, 1)
  const target: NodeTarget = {
    parentId: location.parentId,
    ...(location.slot ? { slot: location.slot } : {}),
    index: location.index,
  }
  return changed([{
    type: 'node.insert',
    pageId,
    subgraph: { root: [cloneModelValue(location.item)], nodesById },
    target,
  }], [pageId], [...subtreeIds], false, nodeChanges)
}

function settingsForNode(node: PageNode): Extract<ProjectOperation, { type: 'node.settings' }>['settings'] {
  const common = {
    component: node.component,
    ...(node.extensions ? { extensions: cloneModelValue(node.extensions) } : {}),
    ...(node.conditions ? { conditions: cloneModelValue(node.conditions) } : {}),
    ...(node.reactions ? { reactions: cloneModelValue(node.reactions) } : {}),
  }
  return node.kind === 'layout'
    ? {
        ...common,
        kind: 'layout',
        ...(node.valueScope ? { valueScope: cloneModelValue(node.valueScope) } : {}),
      }
    : {
        ...common,
        kind: 'field',
        field: node.field,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.defaultValue !== undefined ? { defaultValue: cloneModelValue(node.defaultValue) } : {}),
        ...(node.validation !== undefined ? { validation: cloneModelValue(node.validation) } : {}),
        ...(node.validateOn !== undefined ? { validateOn: cloneModelValue(node.validateOn) } : {}),
        ...(node.optionSource !== undefined ? { optionSource: cloneModelValue(node.optionSource) } : {}),
      }
}

function pageHasValueScopes(graph: ProjectDocument['pagesById'][string]['graph']): boolean {
  const source = isDraft(graph) ? (original(graph) ?? graph) : graph
  return Object.values(source.nodesById).some(node => node.kind === 'layout' && node.valueScope !== undefined)
}

function subgraphRequiresPageContentValidation(subgraph: NodeSubgraph): boolean {
  return Object.values(subgraph.nodesById).some((node) => {
    if (node.kind === 'layout') {
      return node.valueScope !== undefined
        || node.conditions !== undefined
        || node.reactions !== undefined
    }
    return node.optionSource !== undefined
      || node.validation !== undefined
      || node.conditions !== undefined
      || node.reactions !== undefined
  })
}
