import type {
  ApplyProjectDraftTransactionOptions,
  ModelDiagnostic,
  NodePlacement,
  PageNode,
  PageNodeSettings,
  ProjectCommand,
  ProjectCommandAction,
  ProjectCommandResolution,
  ProjectDocument,
  ProjectFlowSettings,
  ProjectNodePatch,
  ProjectNodePatchKey,
  ProjectOperation,
  ProjectTransaction,
} from '../types'
import {
  applyProjectCommandDraftTransaction,
  applyProjectDraftTransaction,
} from './transactions'

class ProjectCommandError extends Error {
  readonly diagnostic: ModelDiagnostic

  constructor(diagnostic: ModelDiagnostic) {
    super(diagnostic.message)
    this.name = 'ProjectCommandError'
    this.diagnostic = diagnostic
  }
}

function invalid(
  code: string,
  message: string,
  pageId?: string,
  nodeId?: string,
): never {
  throw new ProjectCommandError({
    code,
    message,
    ...(pageId ? { pageId } : {}),
    ...(nodeId ? { nodeId } : {}),
  })
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function requirePage(document: ProjectDocument, pageId: string) {
  const page = document.pagesById[pageId]
  if (!page)
    invalid('PROJECT_PAGE_UNKNOWN', `Page does not exist: ${pageId}`, pageId)
  return page
}

function requireNode(document: ProjectDocument, pageId: string, nodeId: string): PageNode {
  const node = requirePage(document, pageId).graph.nodesById[nodeId]
  if (!node)
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}`, pageId, nodeId)
  return node
}

function requireFlow(document: ProjectDocument, pageId: string, flowId: string) {
  const flow = requirePage(document, pageId).flows?.find(candidate => candidate.id === flowId)
  if (!flow)
    invalid('PROJECT_FLOW_UNKNOWN', `Flow does not exist: ${flowId}`, pageId)
  return flow
}

function settingsForNode(node: PageNode): PageNodeSettings {
  const common = {
    component: node.component,
    ...(node.extensions ? { extensions: clone(node.extensions) } : {}),
    ...(node.conditions ? { conditions: clone(node.conditions) } : {}),
    ...(node.reactions ? { reactions: clone(node.reactions) } : {}),
  }
  if (node.kind === 'layout')
    return { ...common, kind: 'layout' }
  return {
    ...common,
    kind: 'field',
    field: node.field,
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.defaultValue !== undefined ? { defaultValue: clone(node.defaultValue) } : {}),
    ...(node.validation !== undefined ? { validation: clone(node.validation) } : {}),
    ...(node.validateOn !== undefined ? { validateOn: clone(node.validateOn) } : {}),
  }
}

const PROJECT_NODE_PATCH_KEYS = new Set<ProjectNodePatchKey>([
  'conditions',
  'defaultValue',
  'extensions',
  'field',
  'label',
  'reactions',
  'validateOn',
  'validation',
])

const PROJECT_FIELD_NODE_PATCH_KEYS = new Set<ProjectNodePatchKey>([
  'defaultValue',
  'field',
  'label',
  'validateOn',
  'validation',
])

function patchNodeSettings(node: PageNode, patch: ProjectNodePatch): PageNodeSettings {
  if (patch.set !== undefined && (typeof patch.set !== 'object' || patch.set === null || Array.isArray(patch.set))) {
    invalid('PROJECT_NODE_PATCH_SET_INVALID', 'Node patch set must be an object.', undefined, node.id)
  }
  if (patch.unset !== undefined && !Array.isArray(patch.unset)) {
    invalid('PROJECT_NODE_PATCH_UNSET_INVALID', 'Node patch unset must be an array.', undefined, node.id)
  }

  const set = patch.set ?? {}
  const unset = patch.unset ?? []
  const setKeys = Object.keys(set)
  const unknownSetKey = setKeys.find(key => !PROJECT_NODE_PATCH_KEYS.has(key as ProjectNodePatchKey))
  const unknownUnsetKey = (unset as unknown[]).find(
    key => typeof key !== 'string' || !PROJECT_NODE_PATCH_KEYS.has(key as ProjectNodePatchKey),
  )
  if (unknownSetKey !== undefined || unknownUnsetKey !== undefined) {
    const key = unknownSetKey ?? String(unknownUnsetKey)
    invalid('PROJECT_NODE_PATCH_KEY_UNKNOWN', `Unknown node patch key: ${key}`, undefined, node.id)
  }

  const undefinedSetKey = setKeys.find(key => (set as Record<string, unknown>)[key] === undefined)
  if (undefinedSetKey) {
    invalid(
      'PROJECT_NODE_PATCH_VALUE_UNDEFINED',
      `Node patch set cannot contain undefined; use unset instead: ${undefinedSetKey}`,
      undefined,
      node.id,
    )
  }

  const duplicateUnsetKey = unset.find((key, index) => unset.indexOf(key) !== index)
  if (duplicateUnsetKey) {
    invalid(
      'PROJECT_NODE_PATCH_UNSET_DUPLICATE',
      `Node patch unset contains a duplicate key: ${duplicateUnsetKey}`,
      undefined,
      node.id,
    )
  }
  const overlappingKey = unset.find(key => Object.hasOwn(set, key))
  if (overlappingKey) {
    invalid(
      'PROJECT_NODE_PATCH_CONFLICT',
      `Node patch cannot set and unset the same key: ${overlappingKey}`,
      undefined,
      node.id,
    )
  }
  if (unset.includes('field')) {
    invalid(
      'PROJECT_NODE_PATCH_REQUIRED_FIELD_UNSET',
      `Field node cannot remove its field key: ${node.id}`,
      undefined,
      node.id,
    )
  }

  const changedKeys = [...setKeys, ...unset] as ProjectNodePatchKey[]
  if (node.kind === 'layout' && changedKeys.some(key => PROJECT_FIELD_NODE_PATCH_KEYS.has(key))) {
    invalid(
      'PROJECT_NODE_PATCH_KIND_INVALID',
      `Layout node cannot accept field settings: ${node.id}`,
      undefined,
      node.id,
    )
  }

  const settings = settingsForNode(node)
  const target = settings as unknown as Record<string, unknown>
  unset.forEach(key => delete target[key])
  Object.entries(set).forEach(([key, value]) => {
    target[key] = clone(value)
  })
  return settings
}

function collectSubtreeIds(
  document: ProjectDocument,
  pageId: string,
  nodeId: string,
  target: string[] = [],
): string[] {
  const node = requireNode(document, pageId, nodeId)
  target.push(node.id)
  if (node.kind === 'layout') {
    Object.values(node.slots).forEach((children) => {
      children.forEach(item => collectSubtreeIds(document, pageId, item.nodeId, target))
    })
  }
  return target
}

function requireNodePlacement(document: ProjectDocument, pageId: string, nodeId: string): NodePlacement {
  const graph = requirePage(document, pageId).graph
  const root = graph.root.find(item => item.nodeId === nodeId)
  if (root)
    return clone(root.placement)
  for (const node of Object.values(graph.nodesById)) {
    if (node.kind !== 'layout')
      continue
    for (const items of Object.values(node.slots)) {
      const item = items.find(candidate => candidate.nodeId === nodeId)
      if (item)
        return clone(item.placement)
    }
  }
  invalid('PROJECT_NODE_LOCATION_UNKNOWN', `Node has no parent location: ${nodeId}`, pageId, nodeId)
}

function duplicateNodeOperation(
  document: ProjectDocument,
  action: Extract<ProjectCommandAction, { type: 'node.duplicate' }>,
): ProjectOperation {
  const page = requirePage(document, action.pageId)
  const sourceIds = collectSubtreeIds(document, action.pageId, action.nodeId)
  const sourceSet = new Set(sourceIds)
  const missingId = sourceIds.find(nodeId => !action.idMap[nodeId])
  if (missingId) {
    invalid(
      'PROJECT_DUPLICATE_MAPPING_INCOMPLETE',
      `Duplicate command is missing an id for node: ${missingId}`,
      action.pageId,
      missingId,
    )
  }

  const nodesById: Record<string, PageNode> = Object.create(null)
  sourceIds.forEach((sourceId) => {
    const source = page.graph.nodesById[sourceId]!
    const duplicated = clone(source)
    const nextId = action.idMap[sourceId]!
    duplicated.id = nextId
    if (duplicated.kind === 'layout') {
      duplicated.slots = Object.fromEntries(Object.entries(duplicated.slots).map(([slot, children]) => [
        slot,
        children.map((item) => {
          if (!sourceSet.has(item.nodeId)) {
            invalid(
              'PROJECT_DUPLICATE_SUBTREE_INVALID',
              `Duplicate subtree references a node outside the source subtree: ${item.nodeId}`,
              action.pageId,
              item.nodeId,
            )
          }
          return {
            nodeId: action.idMap[item.nodeId]!,
            placement: clone(item.placement),
          }
        }),
      ]))
    }
    else if (source.kind === 'field' && action.fieldMap?.[source.field]) {
      duplicated.field = action.fieldMap[source.field]!
    }
    nodesById[nextId] = duplicated
  })

  return {
    type: 'node.insert',
    pageId: action.pageId,
    target: clone(action.target),
    subgraph: {
      root: [{
        nodeId: action.idMap[action.nodeId]!,
        placement: requireNodePlacement(document, action.pageId, action.nodeId),
      }],
      nodesById,
    },
  }
}

function updateFlowSettings(
  document: ProjectDocument,
  pageId: string,
  flowId: string,
  settings: ProjectFlowSettings,
): ProjectOperation {
  const flow = clone(requireFlow(document, pageId, flowId))
  flow.name = settings.name
  flow.trigger = clone(settings.trigger)
  if (settings.concurrency === undefined)
    delete flow.concurrency
  else
    flow.concurrency = settings.concurrency
  if (settings.errorPolicy === undefined)
    delete flow.errorPolicy
  else
    flow.errorPolicy = clone(settings.errorPolicy)
  return { type: 'flow.update', pageId, flowId, flow }
}

function replaceFlowOperations(
  document: ProjectDocument,
  action: Extract<ProjectCommandAction, { type: 'flow.replaceAll' }>,
): ProjectOperation[] {
  const previous = requirePage(document, action.pageId).flows ?? []
  const next = action.flows ?? []
  return [
    ...[...previous].reverse().map(flow => ({
      type: 'flow.remove' as const,
      pageId: action.pageId,
      flowId: flow.id,
    })),
    ...next.map((flow, index) => ({
      type: 'flow.add' as const,
      pageId: action.pageId,
      flow: clone(flow),
      index,
    })),
  ]
}

function resolveAction(document: ProjectDocument, action: ProjectCommandAction): ProjectOperation[] {
  switch (action.type) {
    case 'operation.apply':
      return clone(action.operations)
    case 'node.patch': {
      const node = requireNode(document, action.pageId, action.nodeId)
      return [{
        type: 'node.settings',
        pageId: action.pageId,
        nodeId: action.nodeId,
        settings: patchNodeSettings(node, action.patch),
      }]
    }
    case 'node.resize': {
      requireNode(document, action.pageId, action.nodeId)
      const placement = requireNodePlacement(document, action.pageId, action.nodeId)
      if (action.span === null)
        delete placement.span
      else
        placement.span = action.span
      return [{
        type: 'node.placement',
        pageId: action.pageId,
        nodeId: action.nodeId,
        placement,
      }]
    }
    case 'node.duplicate':
      return [duplicateNodeOperation(document, action)]
    case 'flow.settings':
      return [updateFlowSettings(document, action.pageId, action.flowId, action.settings)]
    case 'flow.node': {
      const flow = clone(requireFlow(document, action.pageId, action.flowId))
      const index = flow.nodes.findIndex(node => node.id === action.nodeId)
      if (index < 0) {
        invalid(
          'PROJECT_FLOW_NODE_UNKNOWN',
          `Flow node does not exist: ${action.nodeId}`,
          action.pageId,
          action.nodeId,
        )
      }
      if (action.node.id !== action.nodeId) {
        invalid(
          'PROJECT_FLOW_NODE_ID_CHANGE_INVALID',
          `Flow node update cannot change its id from ${action.nodeId} to ${action.node.id}.`,
          action.pageId,
          action.nodeId,
        )
      }
      flow.nodes[index] = clone(action.node)
      return [{ type: 'flow.update', pageId: action.pageId, flowId: action.flowId, flow }]
    }
    case 'flow.edges': {
      const flow = clone(requireFlow(document, action.pageId, action.flowId))
      flow.edges = clone(action.edges)
      return [{ type: 'flow.update', pageId: action.pageId, flowId: action.flowId, flow }]
    }
    case 'flow.graph': {
      const flow = clone(requireFlow(document, action.pageId, action.flowId))
      flow.nodes = clone(action.nodes)
      flow.edges = clone(action.edges)
      return [{ type: 'flow.update', pageId: action.pageId, flowId: action.flowId, flow }]
    }
    case 'flow.replaceAll':
      return replaceFlowOperations(document, action)
  }
}

export function resolveProjectCommand(
  document: ProjectDocument,
  command: ProjectCommand,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectCommandResolution {
  if (!command.id.trim() || !command.label.trim()) {
    return {
      success: false,
      diagnostics: [{
        code: 'PROJECT_COMMAND_IDENTITY_INVALID',
        message: 'Commands require non-empty id and label values.',
      }],
    }
  }
  if (command.actions.length === 0) {
    return {
      success: false,
      diagnostics: [{ code: 'PROJECT_COMMAND_EMPTY', message: 'Commands must contain at least one action.' }],
    }
  }

  let current = document
  const operations: ProjectOperation[] = []
  try {
    command.actions.forEach((action, index) => {
      const resolved = resolveAction(current, action)
      if (resolved.length === 0)
        return
      const draft = applyProjectCommandDraftTransaction(current, {
        id: `${command.id}:resolve:${index}`,
        label: command.label,
        operations: resolved,
      }, {
        ...options,
      })
      if (!draft.success)
        throw new ProjectCommandError(draft.diagnostics[0]!)
      current = draft.document
      operations.push(...resolved)
    })
  }
  catch (error) {
    if (error instanceof ProjectCommandError)
      return { success: false, diagnostics: [error.diagnostic] }
    throw error
  }

  const transaction: ProjectTransaction = {
    id: command.id,
    label: command.label,
    operations,
    ...(command.mergeKey ? { mergeKey: command.mergeKey } : {}),
  }
  if (operations.length === 0)
    return { success: true, transaction }
  const validation = applyProjectDraftTransaction(document, transaction, {
    ...options,
  })
  if (!validation.success)
    return { success: false, diagnostics: validation.diagnostics }
  return { success: true, transaction }
}
