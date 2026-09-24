import type { Draft } from 'immer'
import type {
  ApplyProjectDraftTransactionOptions,
  ApplyProjectTransactionOptions,
  DatasetId,
  NodeId,
  NodeSubgraph,
  NodeTarget,
  ProjectChangeSet,
  ProjectDocument,
  ProjectNodeChange,
  ProjectNodeRelation,
  ProjectOperation,
  ProjectSurface,
  ProjectTransaction,
  ProjectTransactionResult,
  ProjectTransactionSuccess,
  ResourceId,
  SlotItem,
  SurfaceGraph,
  SurfaceId,
  SurfaceNode,
  SurfaceNodeSettings,
} from '../../../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { current, Immer, isDraft } from 'immer'
import {
  formSettingsSchema,
  modelJsonObjectSchema,
  nodeSubgraphSchema,
  parseProjectDocument,
  projectDatasetSchema,
  projectResourceSchema,
  projectSurfaceSchema,
  projectThemeSchema,
  surfaceNodeSchema,
} from '../../../schemas'
import { findProjectReferences } from '../../reference-integrity'
import { failure, invalid, TransactionError } from '../errors'
import {
  validateDocumentAgainstRegistry,
  validateRegistryLock,
  validateTrustedIncrementalTransaction,
} from '../validation'
import {
  isValidatedProjectDocument,
  publishProjectTransactionSuccess,
} from './publication'

const projectDocumentImmer = new Immer({ autoFreeze: false })

interface ChangeAccumulator {
  project: boolean
  surfaceIds: Set<SurfaceId>
  datasetIds: Set<DatasetId>
  resourceIds: Set<ResourceId>
  nodeChanges: ProjectNodeChange[]
}

interface AppliedOperation {
  inverse: ProjectOperation[]
  change: Partial<ChangeAccumulator>
}

export function applyProjectTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options, true)
}

export function applyProjectDraftTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options, true)
}

/** Used internally while resolving a multi-action command against staged state. */
export function applyProjectCommandDraftTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options, false)
}

function applyProjectChange(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectTransactionOptions,
  validateDocument: boolean,
): ProjectTransactionResult {
  if (!transaction.id.trim() || !transaction.label.trim())
    return failure(document, 'PROJECT_TRANSACTION_IDENTITY_INVALID', 'Transactions require non-empty id and label values.')
  if (transaction.operations.length === 0)
    return failure(document, 'PROJECT_TRANSACTION_EMPTY', 'Transactions must contain at least one operation.')
  if (options.registry) {
    const lockDiagnostics = validateRegistryLock(document, options.registry)
    if (lockDiagnostics.length > 0)
      return { success: false, document, diagnostics: lockDiagnostics }
  }

  const inverse: ProjectOperation[] = []
  const change: ChangeAccumulator = {
    project: false,
    surfaceIds: new Set(),
    datasetIds: new Set(),
    resourceIds: new Set(),
    nodeChanges: [],
  }
  let candidate: ProjectDocument
  try {
    candidate = projectDocumentImmer.produce(document, (draft) => {
      transaction.operations.forEach((operation) => {
        const result = applyOperation(draft as ProjectDocument, operation)
        inverse.unshift(...result.inverse)
        mergeChange(change, result.change)
      })
    })
  }
  catch (error) {
    if (error instanceof TransactionError)
      return { success: false, document, diagnostics: [error.diagnostic] }
    throw error
  }

  const changed = candidate !== document
    && (transaction.operations.length === 1
      || getConfigFormJsonSemanticHash(candidate) !== getConfigFormJsonSemanticHash(document))
  const changeSet = changed ? freezeChangeSet(change) : emptyChangeSet()
  if (!changed) {
    return {
      success: true,
      changed: false,
      document,
      inverse: inverseTransaction(transaction, []),
      diagnostics: [],
      changeSet,
    }
  }

  if (options.registry && !semanticallyEqual(candidate.registryLock, options.registry.lock)) {
    candidate = projectDocumentImmer.produce(candidate, (draft) => {
      draft.registryLock = clone(options.registry!.lock)
    })
    change.project = true
  }

  if (validateDocument) {
    const incrementalDiagnostics = isValidatedProjectDocument(document)
      ? validateTrustedIncrementalTransaction(document, candidate, transaction.operations, options.registry)
      : undefined
    if (incrementalDiagnostics !== undefined) {
      if (incrementalDiagnostics.length > 0)
        return { success: false, document, diagnostics: incrementalDiagnostics }
    }
    else {
      const parsed = parseProjectDocument(candidate)
      if (!parsed.success)
        return { success: false, document, diagnostics: parsed.diagnostics }
      candidate = parsed.data
      if (options.registry) {
        const registryDiagnostics = validateDocumentAgainstRegistry(candidate, options.registry)
        if (registryDiagnostics.length > 0)
          return { success: false, document, diagnostics: registryDiagnostics }
      }
    }
  }

  const result: ProjectTransactionSuccess = {
    success: true,
    changed: true,
    document: candidate,
    inverse: inverseTransaction(transaction, inverse),
    diagnostics: [],
    changeSet: freezeChangeSet(change),
  }
  return validateDocument ? publishProjectTransactionSuccess(document, result) : result
}

function applyOperation(document: ProjectDocument, operation: ProjectOperation): AppliedOperation {
  switch (operation.type) {
    case 'project.rename': {
      const name = requireDisplayName(operation.name, 'PROJECT_NAME_INVALID')
      if (document.name === name)
        return unchanged()
      const previous = document.name
      document.name = name
      return { inverse: [{ type: 'project.rename', name: previous }], change: { project: true } }
    }
    case 'surface.add':
    case 'surface.copy': {
      const surface = parseValue(projectSurfaceSchema.safeParse(operation.surface), 'PROJECT_SURFACE_INVALID', 'Surface is invalid.')
      if (Object.hasOwn(document.surfacesById, surface.id))
        invalid('PROJECT_SURFACE_ID_DUPLICATE', `Surface already exists: ${surface.id}.`, surface.id)
      const index = operation.index ?? document.surfaceOrder.length
      assertInsertIndex(index, document.surfaceOrder.length, 'PROJECT_SURFACE_INDEX_INVALID')
      document.surfacesById[surface.id] = surface
      document.surfaceOrder.splice(index, 0, surface.id)
      return {
        inverse: [{ type: 'surface.remove', surfaceId: surface.id }],
        change: { project: true, surfaceIds: new Set([surface.id]), nodeChanges: insertedGraphChanges(surface) },
      }
    }
    case 'surface.remove': {
      const surface = requireSurface(document, operation.surfaceId)
      const references = findProjectReferences(document).filter(reference => (
        reference.targetKind === 'surface'
        && reference.targetId === operation.surfaceId
      ))
      if (references.length > 0) {
        invalid(
          'surface_in_use',
          `Surface is still referenced: ${operation.surfaceId}.`,
          operation.surfaceId,
          undefined,
          { surfaceId: operation.surfaceId, references },
        )
      }
      const index = document.surfaceOrder.indexOf(operation.surfaceId)
      document.surfaceOrder.splice(index, 1)
      delete document.surfacesById[operation.surfaceId]
      return {
        inverse: [{ type: 'surface.add', surface: clone(surface), index }],
        change: { project: true, surfaceIds: new Set([operation.surfaceId]), nodeChanges: removedGraphChanges(surface) },
      }
    }
    case 'surface.move': {
      requireSurface(document, operation.surfaceId)
      const previous = document.surfaceOrder.indexOf(operation.surfaceId)
      assertMoveIndex(operation.index, document.surfaceOrder.length, 'PROJECT_SURFACE_INDEX_INVALID')
      if (previous === operation.index)
        return unchanged()
      document.surfaceOrder.splice(previous, 1)
      document.surfaceOrder.splice(operation.index, 0, operation.surfaceId)
      return { inverse: [{ type: 'surface.move', surfaceId: operation.surfaceId, index: previous }], change: { project: true, surfaceIds: new Set([operation.surfaceId]) } }
    }
    case 'surface.rename': {
      const surface = requireSurface(document, operation.surfaceId)
      const name = requireDisplayName(operation.name, 'PROJECT_SURFACE_NAME_INVALID')
      if (surface.name === name)
        return unchanged()
      const previous = surface.name
      surface.name = name
      return { inverse: [{ type: 'surface.rename', surfaceId: surface.id, name: previous }], change: { surfaceIds: new Set([surface.id]) } }
    }
    case 'surface.route': {
      const surface = requireSurface(document, operation.surfaceId)
      if (surface.kind !== 'page')
        invalid('invalid_surface_kind', 'Only Page Surfaces own a route.', surface.id)
      if (!operation.route.startsWith('/') || operation.route.includes('?') || operation.route.includes('#') || operation.route.includes('\\') || operation.route.length > 300)
        invalid('PROJECT_SURFACE_ROUTE_INVALID', 'Page route is invalid.', surface.id)
      if (Object.values(document.surfacesById).some(candidate => candidate.kind === 'page' && candidate.id !== surface.id && candidate.route === operation.route))
        invalid('PROJECT_SURFACE_ROUTE_DUPLICATE', `Page route already exists: ${operation.route}.`, surface.id)
      if (surface.route === operation.route)
        return unchanged()
      const previous = surface.route
      surface.route = operation.route
      return { inverse: [{ type: 'surface.route', surfaceId: surface.id, route: previous }], change: { surfaceIds: new Set([surface.id]) } }
    }
    case 'surface.presentation': {
      const surface = requireSurface(document, operation.surfaceId)
      if (surface.kind === 'page' || operation.presentation.kind !== surface.kind)
        invalid('invalid_surface_kind', 'Surface presentation kind must match the immutable Surface kind.', surface.id)
      const previous = clone(surface.presentation)
      if (semanticallyEqual(previous, operation.presentation))
        return unchanged()
      surface.presentation = clone(operation.presentation) as typeof surface.presentation
      return { inverse: [{ type: 'surface.presentation', surfaceId: surface.id, presentation: previous }], change: { surfaceIds: new Set([surface.id]) } }
    }
    case 'surface.parameters':
      return replaceSurfaceValue(document, operation.surfaceId, 'parameters', operation.parameters, parameters => ({
        type: 'surface.parameters',
        surfaceId: operation.surfaceId,
        parameters,
      }))
    case 'surface.outputs':
      return replaceSurfaceValue(document, operation.surfaceId, 'outputs', operation.outputs, outputs => ({
        type: 'surface.outputs',
        surfaceId: operation.surfaceId,
        outputs,
      }))
    case 'surface.interactions':
      return replaceSurfaceValue(document, operation.surfaceId, 'interactions', operation.interactions, interactions => ({
        type: 'surface.interactions',
        surfaceId: operation.surfaceId,
        interactions,
      }))
    case 'project.home': {
      const target = requireSurface(document, operation.surfaceId)
      if (target.kind !== 'page')
        invalid('invalid_surface_kind', 'Home Surface must be a Page.', target.id)
      if (document.homeSurfaceId === target.id)
        return unchanged()
      const previous = document.homeSurfaceId
      document.homeSurfaceId = target.id
      return { inverse: [{ type: 'project.home', surfaceId: previous }], change: { project: true, surfaceIds: new Set([target.id]) } }
    }
    case 'project.settings': {
      const value = parseValue(modelJsonObjectSchema.safeParse(operation.settings), 'PROJECT_SETTINGS_INVALID', 'Project settings are invalid.')
      if (semanticallyEqual(document.settings, value))
        return unchanged()
      const previous = clone(document.settings)
      document.settings = value
      return { inverse: [{ type: 'project.settings', settings: previous }], change: { project: true } }
    }
    case 'project.theme': {
      const value = parseValue(projectThemeSchema.safeParse(operation.theme), 'project_theme_invalid', 'Project theme is invalid.')
      if (semanticallyEqual(document.theme, value))
        return unchanged()
      const previous = clone(document.theme)
      document.theme = value
      return { inverse: [{ type: 'project.theme', theme: previous }], change: { project: true } }
    }
    case 'surface.props':
      return replaceGraphValue(document, operation.surfaceId, 'props', operation.props, props => ({
        type: 'surface.props',
        surfaceId: operation.surfaceId,
        props,
      }))
    case 'surface.form':
      return replaceGraphValue(document, operation.surfaceId, 'form', operation.form, form => ({
        type: 'surface.form',
        surfaceId: operation.surfaceId,
        form,
      }))
    case 'dataset.add':
    case 'dataset.copy': {
      const dataset = parseValue(projectDatasetSchema.safeParse(operation.dataset), 'PROJECT_DATASET_INVALID', 'Dataset is invalid.')
      if (Object.hasOwn(document.datasetsById, dataset.id))
        invalid('PROJECT_DATASET_ID_DUPLICATE', `Dataset already exists: ${dataset.id}.`, undefined, undefined, { datasetId: dataset.id })
      const index = operation.index ?? document.datasetOrder.length
      assertInsertIndex(index, document.datasetOrder.length, 'PROJECT_DATASET_INDEX_INVALID')
      document.datasetsById[dataset.id] = dataset
      document.datasetOrder.splice(index, 0, dataset.id)
      return { inverse: [{ type: 'dataset.remove', datasetId: dataset.id }], change: { project: true, datasetIds: new Set([dataset.id]) } }
    }
    case 'dataset.remove': {
      const dataset = requireDataset(document, operation.datasetId)
      const references = findProjectReferences(document).filter(reference => reference.targetKind === 'dataset' && reference.targetId === operation.datasetId)
      if (references.length > 0)
        invalid('dataset_reference_invalid', `Dataset is still referenced: ${operation.datasetId}.`, undefined, undefined, { datasetId: operation.datasetId, references })
      const index = document.datasetOrder.indexOf(operation.datasetId)
      document.datasetOrder.splice(index, 1)
      delete document.datasetsById[operation.datasetId]
      return { inverse: [{ type: 'dataset.add', dataset: clone(dataset), index }], change: { project: true, datasetIds: new Set([operation.datasetId]) } }
    }
    case 'dataset.move': {
      requireDataset(document, operation.datasetId)
      const previous = document.datasetOrder.indexOf(operation.datasetId)
      assertMoveIndex(operation.index, document.datasetOrder.length, 'PROJECT_DATASET_INDEX_INVALID')
      if (previous === operation.index)
        return unchanged()
      document.datasetOrder.splice(previous, 1)
      document.datasetOrder.splice(operation.index, 0, operation.datasetId)
      return { inverse: [{ type: 'dataset.move', datasetId: operation.datasetId, index: previous }], change: { project: true, datasetIds: new Set([operation.datasetId]) } }
    }
    case 'dataset.rename': {
      const dataset = requireDataset(document, operation.datasetId)
      const name = requireDisplayName(operation.name, 'PROJECT_DATASET_NAME_INVALID')
      if (dataset.name === name)
        return unchanged()
      const previous = dataset.name
      dataset.name = name
      return { inverse: [{ type: 'dataset.rename', datasetId: dataset.id, name: previous }], change: { datasetIds: new Set([dataset.id]) } }
    }
    case 'dataset.replace': {
      const previous = requireDataset(document, operation.datasetId)
      const dataset = parseValue(projectDatasetSchema.safeParse(operation.dataset), 'PROJECT_DATASET_INVALID', 'Dataset is invalid.')
      if (dataset.id !== operation.datasetId)
        invalid('PROJECT_DATASET_ID_CHANGE_INVALID', 'Dataset replacement cannot change its id.', undefined, undefined, { datasetId: operation.datasetId })
      if (semanticallyEqual(previous, dataset))
        return unchanged()
      document.datasetsById[operation.datasetId] = dataset
      return { inverse: [{ type: 'dataset.replace', datasetId: operation.datasetId, dataset: clone(previous) }], change: { datasetIds: new Set([operation.datasetId]) } }
    }
    case 'dataset.replaceRows': {
      const dataset = requireDataset(document, operation.datasetId)
      const candidate = parseValue(projectDatasetSchema.safeParse({ ...clone(dataset), rows: operation.rows }), 'dataset_rows_invalid', 'Dataset rows are invalid.')
      if (semanticallyEqual(dataset.rows, candidate.rows))
        return unchanged()
      const previous = clone(dataset.rows)
      dataset.rows = candidate.rows
      return { inverse: [{ type: 'dataset.replaceRows', datasetId: dataset.id, rows: previous }], change: { datasetIds: new Set([dataset.id]) } }
    }
    case 'dataset.setDefaultProjection': {
      const dataset = requireDataset(document, operation.datasetId)
      const candidate = parseValue(projectDatasetSchema.safeParse({
        ...clone(dataset),
        ...(operation.projection === undefined ? {} : { defaultProjection: operation.projection }),
      }), 'dataset_projection_invalid', 'Dataset projection is invalid.')
      const previous = dataset.defaultProjection === undefined ? undefined : clone(dataset.defaultProjection)
      if (semanticallyEqual(previous, operation.projection))
        return unchanged()
      if (operation.projection === undefined)
        delete dataset.defaultProjection
      else
        dataset.defaultProjection = candidate.defaultProjection
      return { inverse: [{ type: 'dataset.setDefaultProjection', datasetId: dataset.id, ...(previous === undefined ? {} : { projection: previous }) }], change: { datasetIds: new Set([dataset.id]) } }
    }
    case 'resource.add': {
      const resource = parseValue(projectResourceSchema.safeParse(operation.resource), 'PROJECT_RESOURCE_INVALID', 'Resource is invalid.')
      if (Object.hasOwn(document.resources, resource.id))
        invalid('PROJECT_RESOURCE_ID_DUPLICATE', `Resource already exists: ${resource.id}.`, undefined, undefined, { resourceId: resource.id })
      document.resources[resource.id] = resource
      return { inverse: [{ type: 'resource.remove', resourceId: resource.id }], change: { project: true, resourceIds: new Set([resource.id]) } }
    }
    case 'resource.remove': {
      const resource = requireResource(document, operation.resourceId)
      const references = findProjectReferences(document).filter(reference => reference.targetKind === 'resource' && reference.targetId === operation.resourceId)
      if (references.length > 0)
        invalid('resource_reference_invalid', `Resource is still referenced: ${operation.resourceId}.`, undefined, undefined, { resourceId: operation.resourceId, references })
      delete document.resources[operation.resourceId]
      return { inverse: [{ type: 'resource.add', resource: clone(resource) }], change: { project: true, resourceIds: new Set([operation.resourceId]) } }
    }
    case 'resource.rename': {
      const resource = requireResource(document, operation.resourceId)
      const name = requireDisplayName(operation.name, 'PROJECT_RESOURCE_NAME_INVALID')
      if (resource.name === name)
        return unchanged()
      const previous = resource.name
      resource.name = name
      return { inverse: [{ type: 'resource.rename', resourceId: resource.id, name: previous }], change: { resourceIds: new Set([resource.id]) } }
    }
    case 'resource.replace': {
      const previous = requireResource(document, operation.resourceId)
      const resource = parseValue(projectResourceSchema.safeParse(operation.resource), 'PROJECT_RESOURCE_INVALID', 'Resource is invalid.')
      if (resource.id !== operation.resourceId)
        invalid('PROJECT_RESOURCE_ID_CHANGE_INVALID', 'Resource replacement cannot change its id.', undefined, undefined, { resourceId: operation.resourceId })
      if (semanticallyEqual(previous, resource))
        return unchanged()
      document.resources[operation.resourceId] = resource
      return { inverse: [{ type: 'resource.replace', resourceId: operation.resourceId, resource: clone(previous) }], change: { resourceIds: new Set([operation.resourceId]) } }
    }
    case 'node.insert':
      return insertSubgraph(document, operation.surfaceId, operation.subgraph, operation.target)
    case 'node.move':
      return moveNode(document, operation.surfaceId, operation.nodeId, operation.target)
    case 'node.props': {
      const node = requireNode(document, operation.surfaceId, operation.nodeId)
      const next = parseValue(surfaceNodeSchema.safeParse({ ...clone(node), props: operation.props }), 'PROJECT_NODE_INVALID', 'Node is invalid.', operation.surfaceId, node.id)
      if (semanticallyEqual(node.props, next.props))
        return unchanged()
      const previous = clone(node.props)
      requireSurface(document, operation.surfaceId).graph.nodesById[node.id] = next
      return nodeContentChange(operation.surfaceId, node.id, [{ type: 'node.props', surfaceId: operation.surfaceId, nodeId: node.id, props: previous }])
    }
    case 'node.placement': {
      const surface = requireSurface(document, operation.surfaceId)
      requireNode(document, operation.surfaceId, operation.nodeId)
      const location = requireNodeLocation(surface.graph, operation.nodeId, operation.surfaceId)
      const placement = parseValue(modelJsonObjectSchema.safeParse(operation.placement), 'PROJECT_NODE_PLACEMENT_INVALID', 'Node placement is invalid.', operation.surfaceId, operation.nodeId)
      if (semanticallyEqual(location.item.placement, placement))
        return unchanged()
      const previous = clone(location.item.placement)
      location.item.placement = placement
      return nodeContentChange(operation.surfaceId, operation.nodeId, [{ type: 'node.placement', surfaceId: operation.surfaceId, nodeId: operation.nodeId, placement: previous }])
    }
    case 'node.settings':
      return updateNodeSettings(document, operation.surfaceId, operation.nodeId, operation.settings)
    case 'node.remove':
      return removeNode(document, operation.surfaceId, operation.nodeId)
  }
}

function replaceSurfaceValue<K extends 'parameters' | 'outputs' | 'interactions'>(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  key: K,
  value: ProjectSurface[K],
  createInverse: (previous: ProjectSurface[K]) => ProjectOperation,
): AppliedOperation {
  const surface = requireSurface(document, surfaceId)
  const candidate = parseValue(projectSurfaceSchema.safeParse({ ...clone(surface), [key]: value }), 'PROJECT_SURFACE_INVALID', 'Surface is invalid.', surfaceId)
  if (semanticallyEqual(surface[key], candidate[key]))
    return unchanged()
  const previous = clone(surface[key])
  surface[key] = candidate[key] as ProjectSurface[K]
  return {
    inverse: [createInverse(previous)],
    change: { surfaceIds: new Set([surfaceId]) },
  }
}

function replaceGraphValue<K extends 'props' | 'form'>(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  key: K,
  value: SurfaceGraph[K],
  createInverse: (previous: SurfaceGraph[K]) => ProjectOperation,
): AppliedOperation {
  const surface = requireSurface(document, surfaceId)
  const parsed = key === 'props'
    ? parseValue(modelJsonObjectSchema.safeParse(value), 'PROJECT_SURFACE_PROPS_INVALID', 'Surface properties are invalid.', surfaceId)
    : parseValue(formSettingsSchema.safeParse(value), 'PROJECT_SURFACE_FORM_INVALID', 'Surface form settings are invalid.', surfaceId)
  if (semanticallyEqual(surface.graph[key], parsed))
    return unchanged()
  const previous = clone(surface.graph[key])
  ;(surface.graph[key] as typeof parsed) = parsed
  return {
    inverse: [createInverse(previous)],
    change: { surfaceIds: new Set([surfaceId]) },
  }
}

function insertSubgraph(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  subgraph: NodeSubgraph,
  target: NodeTarget,
): AppliedOperation {
  if (subgraph.root.length === 0 && Object.keys(subgraph.nodesById).length === 0)
    return unchanged()
  const surface = requireSurface(document, surfaceId)
  const parsed = nodeSubgraphSchema.safeParse({
    version: surface.graph.version,
    props: {},
    form: {},
    root: subgraph.root,
    nodesById: subgraph.nodesById,
  })
  if (!parsed.success)
    invalid('PROJECT_NODE_SUBGRAPH_INVALID', parsed.error.issues[0]?.message ?? 'Inserted subgraph is invalid.', surfaceId)
  const normalized: NodeSubgraph = { root: parsed.data.root, nodesById: parsed.data.nodesById }
  const duplicate = Object.keys(normalized.nodesById).find(nodeId => Object.hasOwn(surface.graph.nodesById, nodeId))
  if (duplicate)
    invalid('PROJECT_NODE_ID_DUPLICATE', `Node already exists: ${duplicate}.`, surfaceId, duplicate)
  const sequence = resolveTargetSequence(surface.graph, target, surfaceId)
  const index = target.index ?? sequence.length
  assertInsertIndex(index, sequence.length, 'PROJECT_NODE_INDEX_INVALID')
  Object.entries(normalized.nodesById).forEach(([nodeId, node]) => {
    surface.graph.nodesById[nodeId] = node
  })
  sequence.splice(index, 0, ...normalized.root)
  const changes = collectGraphChanges(surfaceId, normalized, 'insert', target)
  if (target.parentId)
    changes.push({ kind: 'content', surfaceId, nodeId: target.parentId })
  return {
    inverse: [...normalized.root].reverse().map(item => ({ type: 'node.remove', surfaceId, nodeId: item.nodeId })),
    change: { surfaceIds: new Set([surfaceId]), nodeChanges: changes },
  }
}

function moveNode(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  nodeId: NodeId,
  target: NodeTarget,
): AppliedOperation {
  const surface = requireSurface(document, surfaceId)
  const location = requireNodeLocation(surface.graph, nodeId, surfaceId)
  if (target.parentId && collectSubtreeIds(surface.graph, nodeId).has(target.parentId))
    invalid('PROJECT_NODE_MOVE_CYCLE', 'A node cannot be moved into its own subtree.', surfaceId, nodeId)
  const previousTarget: NodeTarget = {
    parentId: location.parentId,
    ...(location.slot ? { slot: location.slot } : {}),
    index: location.index,
  }
  const targetSlot = target.parentId === null ? undefined : (target.slot ?? 'default')
  const sameSequence = target.parentId === location.parentId && targetSlot === location.slot
  const requestedIndex = target.index ?? (sameSequence ? location.sequence.length - 1 : undefined)
  if (sameSequence && requestedIndex === location.index)
    return unchanged()
  location.sequence.splice(location.index, 1)
  const destination = resolveTargetSequence(surface.graph, target, surfaceId)
  const index = target.index ?? destination.length
  assertInsertIndex(index, destination.length, 'PROJECT_NODE_INDEX_INVALID')
  destination.splice(index, 0, location.item)
  const changes: ProjectNodeChange[] = [{
    kind: 'move',
    surfaceId,
    nodeId,
    before: relation(location.parentId, location.slot),
    after: relation(target.parentId, targetSlot),
  }]
  for (const parentId of new Set([location.parentId, target.parentId])) {
    if (parentId)
      changes.push({ kind: 'content', surfaceId, nodeId: parentId })
  }
  return {
    inverse: [{ type: 'node.move', surfaceId, nodeId, target: previousTarget }],
    change: { surfaceIds: new Set([surfaceId]), nodeChanges: changes },
  }
}

function updateNodeSettings(
  document: ProjectDocument,
  surfaceId: SurfaceId,
  nodeId: NodeId,
  settings: SurfaceNodeSettings,
): AppliedOperation {
  const surface = requireSurface(document, surfaceId)
  const node = requireNode(document, surfaceId, nodeId)
  if (node.kind !== settings.kind)
    invalid('PROJECT_NODE_KIND_CHANGE_INVALID', 'Node settings cannot change node kind.', surfaceId, nodeId)
  const previous = settingsForNode(node)
  if (semanticallyEqual(previous, settings))
    return unchanged()
  const common = {
    id: node.id,
    component: settings.component,
    props: node.props,
    ...(settings.extensions ? { extensions: clone(settings.extensions) } : {}),
    ...(settings.datasetBindings ? { datasetBindings: clone(settings.datasetBindings) } : {}),
    ...(settings.resourceBindings ? { resourceBindings: clone(settings.resourceBindings) } : {}),
  }
  const candidate = settings.kind === 'field'
    ? {
        ...common,
        kind: 'field' as const,
        field: settings.field,
        ...(settings.label !== undefined ? { label: settings.label } : {}),
        ...(settings.defaultValue !== undefined ? { defaultValue: clone(settings.defaultValue) } : {}),
        ...(settings.required !== undefined ? { required: settings.required } : {}),
        ...(settings.requiredMessage !== undefined ? { requiredMessage: settings.requiredMessage } : {}),
        ...(settings.validation !== undefined ? { validation: clone(settings.validation) } : {}),
        ...(settings.validateOn !== undefined ? { validateOn: clone(settings.validateOn) } : {}),
      }
    : settings.kind === 'layout'
      ? {
          ...common,
          kind: 'layout' as const,
          slots: node.kind === 'layout' ? node.slots : {},
          ...(settings.valueScope ? { valueScope: clone(settings.valueScope) } : {}),
        }
      : { ...common, kind: 'element' as const }
  const parsed = parseValue(surfaceNodeSchema.safeParse(candidate), 'PROJECT_NODE_INVALID', 'Node is invalid.', surfaceId, nodeId)
  surface.graph.nodesById[nodeId] = parsed
  return nodeContentChange(surfaceId, nodeId, [{ type: 'node.settings', surfaceId, nodeId, settings: previous }])
}

function removeNode(document: ProjectDocument, surfaceId: SurfaceId, nodeId: NodeId): AppliedOperation {
  const surface = requireSurface(document, surfaceId)
  const location = requireNodeLocation(surface.graph, nodeId, surfaceId)
  const subtree = collectSubtreeIds(surface.graph, nodeId)
  const nodesById: Record<NodeId, SurfaceNode> = Object.create(null)
  subtree.forEach((id) => {
    nodesById[id] = clone(surface.graph.nodesById[id]!)
    delete surface.graph.nodesById[id]
  })
  location.sequence.splice(location.index, 1)
  const target: NodeTarget = {
    parentId: location.parentId,
    ...(location.slot ? { slot: location.slot } : {}),
    index: location.index,
  }
  const removedGraph: NodeSubgraph = { root: [clone(location.item)], nodesById }
  const changes = collectGraphChanges(surfaceId, removedGraph, 'remove', target)
  if (location.parentId)
    changes.push({ kind: 'content', surfaceId, nodeId: location.parentId })
  return {
    inverse: [{ type: 'node.insert', surfaceId, subgraph: removedGraph, target }],
    change: { surfaceIds: new Set([surfaceId]), nodeChanges: changes },
  }
}

interface NodeLocation {
  index: number
  item: SlotItem
  parentId: NodeId | null
  sequence: SlotItem[]
  slot?: string
}

function findNodeLocation(graph: SurfaceGraph, nodeId: NodeId): NodeLocation | undefined {
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

function requireNodeLocation(graph: SurfaceGraph, nodeId: NodeId, surfaceId: SurfaceId): NodeLocation {
  const location = findNodeLocation(graph, nodeId)
  if (!location)
    invalid('PROJECT_NODE_LOCATION_UNKNOWN', `Node has no parent location: ${nodeId}.`, surfaceId, nodeId)
  return location
}

function resolveTargetSequence(graph: SurfaceGraph, target: NodeTarget, surfaceId: SurfaceId): SlotItem[] {
  if (target.parentId === null) {
    if (target.slot)
      invalid('PROJECT_ROOT_SLOT_INVALID', 'Root node targets cannot specify a slot.', surfaceId)
    return graph.root
  }
  const parent = graph.nodesById[target.parentId]
  if (!parent)
    invalid('PROJECT_TARGET_PARENT_UNKNOWN', `Target parent does not exist: ${target.parentId}.`, surfaceId, target.parentId)
  if (parent.kind !== 'layout')
    invalid('PROJECT_TARGET_PARENT_INVALID', `Target parent is not a layout: ${target.parentId}.`, surfaceId, target.parentId)
  const slot = target.slot ?? 'default'
  assertSafeKey(slot, 'PROJECT_TARGET_SLOT_INVALID', surfaceId)
  return parent.slots[slot] ??= []
}

function collectSubtreeIds(graph: SurfaceGraph, nodeId: NodeId, result = new Set<NodeId>()): Set<NodeId> {
  if (result.has(nodeId))
    return result
  result.add(nodeId)
  const node = graph.nodesById[nodeId]
  if (node?.kind === 'layout')
    Object.values(node.slots).forEach(items => items.forEach(item => collectSubtreeIds(graph, item.nodeId, result)))
  return result
}

function collectGraphChanges(
  surfaceId: SurfaceId,
  graph: Pick<SurfaceGraph, 'root' | 'nodesById'>,
  kind: 'insert' | 'remove',
  rootTarget: NodeTarget,
): ProjectNodeChange[] {
  const changes: ProjectNodeChange[] = []
  const visit = (nodeId: NodeId, location: ProjectNodeRelation): void => {
    changes.push({ kind, surfaceId, nodeId, ...(kind === 'insert' ? { after: location } : { before: location }) })
    const node = graph.nodesById[nodeId]
    if (node?.kind === 'layout') {
      Object.entries(node.slots).forEach(([slot, items]) => {
        items.forEach(item => visit(item.nodeId, relation(node.id, slot)))
      })
    }
  }
  graph.root.forEach(item => visit(item.nodeId, relation(rootTarget.parentId, rootTarget.slot)))
  return changes
}

function insertedGraphChanges(surface: ProjectSurface): ProjectNodeChange[] {
  return collectGraphChanges(surface.id, surface.graph, 'insert', { parentId: null })
}

function removedGraphChanges(surface: ProjectSurface): ProjectNodeChange[] {
  return collectGraphChanges(surface.id, surface.graph, 'remove', { parentId: null })
}

function settingsForNode(node: SurfaceNode): SurfaceNodeSettings {
  const common = {
    component: node.component,
    ...(node.extensions ? { extensions: clone(node.extensions) } : {}),
    ...(node.datasetBindings ? { datasetBindings: clone(node.datasetBindings) } : {}),
    ...(node.resourceBindings ? { resourceBindings: clone(node.resourceBindings) } : {}),
  }
  if (node.kind === 'layout') {
    return { ...common, kind: 'layout', ...(node.valueScope ? { valueScope: clone(node.valueScope) } : {}) }
  }
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

function nodeContentChange(surfaceId: SurfaceId, nodeId: NodeId, inverse: ProjectOperation[]): AppliedOperation {
  return {
    inverse,
    change: { surfaceIds: new Set([surfaceId]), nodeChanges: [{ kind: 'content', surfaceId, nodeId }] },
  }
}

function requireSurface(document: ProjectDocument, surfaceId: SurfaceId): ProjectSurface {
  if (!Object.hasOwn(document.surfacesById, surfaceId))
    invalid('PROJECT_SURFACE_UNKNOWN', `Surface does not exist: ${surfaceId}.`, surfaceId)
  return document.surfacesById[surfaceId]!
}

function requireDataset(document: ProjectDocument, datasetId: DatasetId) {
  if (!Object.hasOwn(document.datasetsById, datasetId))
    invalid('PROJECT_DATASET_UNKNOWN', `Dataset does not exist: ${datasetId}.`, undefined, undefined, { datasetId })
  return document.datasetsById[datasetId]!
}

function requireResource(document: ProjectDocument, resourceId: ResourceId) {
  if (!Object.hasOwn(document.resources, resourceId))
    invalid('PROJECT_RESOURCE_UNKNOWN', `Resource does not exist: ${resourceId}.`, undefined, undefined, { resourceId })
  return document.resources[resourceId]!
}

function requireNode(document: ProjectDocument, surfaceId: SurfaceId, nodeId: NodeId): SurfaceNode {
  const node = requireSurface(document, surfaceId).graph.nodesById[nodeId]
  if (!node)
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}.`, surfaceId, nodeId)
  return node
}

function parseValue<T>(
  result: { success: true, data: T } | { success: false, error: { issues: Array<{ message: string }> } },
  code: string,
  message: string,
  surfaceId?: SurfaceId,
  nodeId?: NodeId,
): T {
  if (result.success)
    return result.data
  invalid(code, `${message} ${result.error.issues[0]?.message ?? ''}`.trim(), surfaceId, nodeId)
}

function requireDisplayName(value: string, code: string): string {
  const name = value.trim()
  if (!name || name.length > 160)
    invalid(code, 'Asset names must contain 1..160 characters.')
  return name
}

function assertInsertIndex(index: number, length: number, code: string): void {
  if (!Number.isInteger(index) || index < 0 || index > length)
    invalid(code, `Insert index ${index} is outside 0..${length}.`)
}

function assertMoveIndex(index: number, length: number, code: string): void {
  if (!Number.isInteger(index) || index < 0 || index >= length)
    invalid(code, `Move index ${index} is outside 0..${Math.max(0, length - 1)}.`)
}

function assertSafeKey(key: string, code: string, surfaceId?: SurfaceId): void {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype')
    invalid(code, `Record key is not allowed: ${key}.`, surfaceId)
}

function relation(parentId: NodeId | null, slot?: string): ProjectNodeRelation {
  return { parentId, slot: parentId === null ? null : (slot ?? 'default') }
}

function mergeChange(target: ChangeAccumulator, source: Partial<ChangeAccumulator>): void {
  target.project ||= source.project ?? false
  source.surfaceIds?.forEach(id => target.surfaceIds.add(id))
  source.datasetIds?.forEach(id => target.datasetIds.add(id))
  source.resourceIds?.forEach(id => target.resourceIds.add(id))
  if (source.nodeChanges)
    target.nodeChanges.push(...source.nodeChanges)
}

function freezeChangeSet(change: ChangeAccumulator): ProjectChangeSet {
  return Object.freeze({
    project: change.project,
    surfaceIds: Object.freeze([...change.surfaceIds]),
    datasetIds: Object.freeze([...change.datasetIds]),
    resourceIds: Object.freeze([...change.resourceIds]),
    nodeChanges: Object.freeze(normalizeNodeChanges(change.nodeChanges)),
  })
}

function emptyChangeSet(): ProjectChangeSet {
  return Object.freeze({
    project: false,
    surfaceIds: Object.freeze([]),
    datasetIds: Object.freeze([]),
    resourceIds: Object.freeze([]),
    nodeChanges: Object.freeze([]),
  })
}

function normalizeNodeChanges(changes: ProjectNodeChange[]): ProjectNodeChange[] {
  const result = new Map<string, ProjectNodeChange>()
  changes.forEach((change) => {
    const key = `${change.surfaceId}\0${change.nodeId}`
    const previous = result.get(key)
    if (!previous) {
      result.set(key, clone(change))
      return
    }
    if (previous.kind === 'insert' && change.kind === 'remove') {
      result.delete(key)
      return
    }
    const kind = change.kind === 'remove'
      ? 'remove'
      : previous.kind === 'remove' && change.kind === 'insert'
        ? 'content'
        : previous.kind === 'insert'
          ? 'insert'
          : previous.kind === 'content' || change.kind === 'content'
            ? 'content'
            : change.kind
    result.set(key, {
      kind,
      surfaceId: change.surfaceId,
      nodeId: change.nodeId,
      ...(previous.before ?? change.before ? { before: previous.before ?? change.before } : {}),
      ...(change.after ?? previous.after ? { after: change.after ?? previous.after } : {}),
    })
  })
  return [...result.values()]
}

function inverseTransaction(transaction: ProjectTransaction, operations: ProjectOperation[]): ProjectTransaction {
  return { id: `${transaction.id}:inverse`, label: `Undo ${transaction.label}`, operations }
}

function clone<T>(value: T): T {
  const source = isDraft(value) ? current(value as Draft<T>) : value
  return structuredClone(source)
}

function semanticallyEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (left === undefined || right === undefined)
    return false
  return getConfigFormJsonSemanticHash(left) === getConfigFormJsonSemanticHash(right)
}

function unchanged(): AppliedOperation {
  return { inverse: [], change: {} }
}
