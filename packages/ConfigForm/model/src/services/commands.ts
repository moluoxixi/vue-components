import type {
  ApplyProjectDraftTransactionOptions,
  NodeId,
  NodePlacement,
  ProjectCommand,
  ProjectCommandAction,
  ProjectCommandResolution,
  ProjectDocument,
  ProjectNodePatch,
  ProjectNodePatchKey,
  ProjectOperation,
  ProjectTransaction,
  SurfaceNode,
  SurfaceNodeSettings,
} from '../types'
import { applyProjectCommandDraftTransaction, applyProjectDraftTransaction } from './transactions'

class ProjectCommandError extends Error {
  readonly code: string
  readonly surfaceId?: string
  readonly nodeId?: string

  constructor(code: string, message: string, surfaceId?: string, nodeId?: string) {
    super(message)
    this.name = 'ProjectCommandError'
    this.code = code
    this.surfaceId = surfaceId
    this.nodeId = nodeId
  }
}

const PATCH_KEYS = new Set<ProjectNodePatchKey>([
  'datasetBindings',
  'defaultValue',
  'extensions',
  'field',
  'label',
  'required',
  'requiredMessage',
  'resourceBindings',
  'validateOn',
  'validation',
  'valueScope',
])
const FIELD_KEYS = new Set<ProjectNodePatchKey>([
  'defaultValue',
  'field',
  'label',
  'required',
  'requiredMessage',
  'validateOn',
  'validation',
])

export function resolveProjectCommand(
  document: ProjectDocument,
  command: ProjectCommand,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectCommandResolution {
  if (!command.id.trim() || !command.label.trim()) {
    return { success: false, diagnostics: [{ code: 'PROJECT_COMMAND_IDENTITY_INVALID', message: 'Commands require non-empty id and label values.' }] }
  }
  if (command.actions.length === 0)
    return { success: false, diagnostics: [{ code: 'PROJECT_COMMAND_EMPTY', message: 'Commands must contain at least one action.' }] }

  let current = document
  const operations: ProjectOperation[] = []
  try {
    command.actions.forEach((action, index) => {
      const resolved = resolveAction(current, action)
      if (resolved.length === 0)
        return
      const staged = applyProjectCommandDraftTransaction(current, {
        id: `${command.id}:resolve:${index}`,
        label: command.label,
        operations: resolved,
      }, options)
      if (!staged.success)
        throw new ProjectCommandError(staged.diagnostics[0]?.code ?? 'PROJECT_COMMAND_INVALID', staged.diagnostics[0]?.message ?? 'Command is invalid.')
      current = staged.document
      operations.push(...resolved)
    })
  }
  catch (error) {
    if (error instanceof ProjectCommandError) {
      return {
        success: false,
        diagnostics: [{
          code: error.code,
          message: error.message,
          ...(error.surfaceId ? { surfaceId: error.surfaceId } : {}),
          ...(error.nodeId ? { nodeId: error.nodeId } : {}),
        }],
      }
    }
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
  const validation = applyProjectDraftTransaction(document, transaction, options)
  return validation.success
    ? { success: true, transaction }
    : { success: false, diagnostics: validation.diagnostics }
}

function resolveAction(document: ProjectDocument, action: ProjectCommandAction): ProjectOperation[] {
  switch (action.type) {
    case 'operation.apply':
      return clone(action.operations)
    case 'node.patch': {
      const node = requireNode(document, action.surfaceId, action.nodeId)
      return [{
        type: 'node.settings',
        surfaceId: action.surfaceId,
        nodeId: action.nodeId,
        settings: patchNodeSettings(node, action.patch, action.surfaceId),
      }]
    }
    case 'node.resize': {
      requireNode(document, action.surfaceId, action.nodeId)
      const placement = requireNodePlacement(document, action.surfaceId, action.nodeId)
      if (action.span === null)
        delete placement.span
      else
        placement.span = action.span
      return [{ type: 'node.placement', surfaceId: action.surfaceId, nodeId: action.nodeId, placement }]
    }
    case 'node.duplicate':
      return [duplicateNodeOperation(document, action)]
  }
}

function patchNodeSettings(
  node: SurfaceNode,
  patch: ProjectNodePatch,
  surfaceId: string,
): SurfaceNodeSettings {
  if (patch.set !== undefined && (!patch.set || typeof patch.set !== 'object' || Array.isArray(patch.set)))
    fail('PROJECT_NODE_PATCH_SET_INVALID', 'Node patch set must be an object.', surfaceId, node.id)
  if (patch.unset !== undefined && !Array.isArray(patch.unset))
    fail('PROJECT_NODE_PATCH_UNSET_INVALID', 'Node patch unset must be an array.', surfaceId, node.id)
  const set = patch.set ?? {}
  const unset = patch.unset ?? []
  const unknown = [...Object.keys(set), ...unset].find(key => !PATCH_KEYS.has(key as ProjectNodePatchKey))
  if (unknown)
    fail('PROJECT_NODE_PATCH_KEY_UNKNOWN', `Unknown node patch key: ${unknown}.`, surfaceId, node.id)
  const undefinedKey = Object.keys(set).find(key => (set as Record<string, unknown>)[key] === undefined)
  if (undefinedKey)
    fail('PROJECT_NODE_PATCH_VALUE_UNDEFINED', `Use unset instead of undefined for ${undefinedKey}.`, surfaceId, node.id)
  if (new Set(unset).size !== unset.length)
    fail('PROJECT_NODE_PATCH_UNSET_DUPLICATE', 'Node patch unset contains a duplicate key.', surfaceId, node.id)
  const conflict = unset.find(key => Object.hasOwn(set, key))
  if (conflict)
    fail('PROJECT_NODE_PATCH_CONFLICT', `Node patch cannot set and unset ${conflict}.`, surfaceId, node.id)
  if (unset.includes('field'))
    fail('PROJECT_NODE_PATCH_REQUIRED_FIELD_UNSET', 'Field cannot be unset.', surfaceId, node.id)

  const changed = [...Object.keys(set), ...unset] as ProjectNodePatchKey[]
  if (node.kind !== 'field' && changed.some(key => FIELD_KEYS.has(key)))
    fail('PROJECT_NODE_PATCH_KIND_INVALID', `${node.kind} nodes cannot accept field settings.`, surfaceId, node.id)
  if (node.kind !== 'layout' && changed.includes('valueScope'))
    fail('PROJECT_NODE_PATCH_KIND_INVALID', `${node.kind} nodes cannot accept valueScope.`, surfaceId, node.id)

  const settings = settingsForNode(node)
  const target = settings as unknown as Record<string, unknown>
  unset.forEach(key => delete target[key])
  Object.entries(set).forEach(([key, value]) => {
    target[key] = clone(value)
  })
  return settings
}

function duplicateNodeOperation(
  document: ProjectDocument,
  action: Extract<ProjectCommandAction, { type: 'node.duplicate' }>,
): ProjectOperation {
  const surface = requireSurface(document, action.surfaceId)
  const sourceIds = [...collectSubtreeIds(surface.graph.nodesById, action.nodeId)]
  const sourceSet = new Set(sourceIds)
  const idMap = new Map<NodeId, NodeId>()
  const nextIds = new Set<NodeId>()
  sourceIds.forEach((sourceId) => {
    const targetId = action.idMap[sourceId]
    if (!targetId)
      fail('PROJECT_DUPLICATE_MAPPING_INCOMPLETE', `Missing duplicated node id for ${sourceId}.`, action.surfaceId, sourceId)
    if (nextIds.has(targetId) || Object.hasOwn(surface.graph.nodesById, targetId))
      fail('PROJECT_DUPLICATE_MAPPING_CONFLICT', `Duplicated node id is not unique: ${targetId}.`, action.surfaceId, targetId)
    nextIds.add(targetId)
    idMap.set(sourceId, targetId)
  })

  const fieldMap = new Map(Object.entries(action.fieldMap ?? {}))
  const nodesById: Record<string, SurfaceNode> = Object.create(null)
  sourceIds.forEach((sourceId) => {
    const source = surface.graph.nodesById[sourceId]!
    const duplicated = clone(source)
    duplicated.id = idMap.get(sourceId)!
    if (duplicated.kind === 'field')
      duplicated.field = fieldMap.get(duplicated.field) ?? duplicated.field
    if (duplicated.kind === 'layout') {
      if (duplicated.valueScope)
        duplicated.valueScope.field = fieldMap.get(duplicated.valueScope.field) ?? duplicated.valueScope.field
      Object.values(duplicated.slots).forEach((items) => {
        items.forEach((item) => {
          if (!sourceSet.has(item.nodeId))
            fail('PROJECT_DUPLICATE_SUBTREE_INVALID', `Subtree references external node ${item.nodeId}.`, action.surfaceId, item.nodeId)
          item.nodeId = idMap.get(item.nodeId)!
        })
      })
    }
    nodesById[duplicated.id] = duplicated
  })
  return {
    type: 'node.insert',
    surfaceId: action.surfaceId,
    target: clone(action.target),
    subgraph: {
      root: [{ nodeId: idMap.get(action.nodeId)!, placement: requireNodePlacement(document, action.surfaceId, action.nodeId) }],
      nodesById,
    },
  }
}

function settingsForNode(node: SurfaceNode): SurfaceNodeSettings {
  const common = {
    component: node.component,
    ...(node.extensions ? { extensions: clone(node.extensions) } : {}),
    ...(node.datasetBindings ? { datasetBindings: clone(node.datasetBindings) } : {}),
    ...(node.resourceBindings ? { resourceBindings: clone(node.resourceBindings) } : {}),
  }
  if (node.kind === 'layout')
    return { ...common, kind: 'layout', ...(node.valueScope ? { valueScope: clone(node.valueScope) } : {}) }
  if (node.kind === 'element')
    return { ...common, kind: 'element' }
  return {
    ...common,
    kind: 'field',
    field: node.field,
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.defaultValue !== undefined ? { defaultValue: clone(node.defaultValue) } : {}),
    ...(node.required !== undefined ? { required: node.required } : {}),
    ...(node.requiredMessage !== undefined ? { requiredMessage: node.requiredMessage } : {}),
    ...(node.validation !== undefined ? { validation: clone(node.validation) } : {}),
    ...(node.validateOn !== undefined ? { validateOn: clone(node.validateOn) } : {}),
  }
}

function collectSubtreeIds(
  nodesById: Record<string, SurfaceNode>,
  nodeId: string,
  result = new Set<string>(),
): Set<string> {
  if (result.has(nodeId))
    return result
  const node = nodesById[nodeId]
  if (!node)
    return result
  result.add(nodeId)
  if (node.kind === 'layout')
    Object.values(node.slots).forEach(items => items.forEach(item => collectSubtreeIds(nodesById, item.nodeId, result)))
  return result
}

function requireNodePlacement(document: ProjectDocument, surfaceId: string, nodeId: string): NodePlacement {
  const graph = requireSurface(document, surfaceId).graph
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
  fail('PROJECT_NODE_LOCATION_UNKNOWN', `Node has no parent location: ${nodeId}.`, surfaceId, nodeId)
}

function requireSurface(document: ProjectDocument, surfaceId: string) {
  const surface = document.surfacesById[surfaceId]
  if (!surface)
    fail('PROJECT_SURFACE_UNKNOWN', `Surface does not exist: ${surfaceId}.`, surfaceId)
  return surface
}

function requireNode(document: ProjectDocument, surfaceId: string, nodeId: string): SurfaceNode {
  const node = requireSurface(document, surfaceId).graph.nodesById[nodeId]
  if (!node)
    fail('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}.`, surfaceId, nodeId)
  return node
}

function fail(code: string, message: string, surfaceId?: string, nodeId?: string): never {
  throw new ProjectCommandError(code, message, surfaceId, nodeId)
}

function clone<T>(value: T): T {
  return structuredClone(value)
}
