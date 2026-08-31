import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { Draft } from 'immer'
import type {
  ComponentContract,
  ComponentContractRegistry,
  LayoutNode,
  ModelDiagnostic,
  NodeId,
  NodeSubgraph,
  NodeTarget,
  PageGraph,
  PageId,
  PageNode,
  ProjectDocument,
  ProjectNodeChange,
  ProjectNodeRelation,
  ProjectOperation,
  ProjectPage,
  ProjectTransaction,
  ProjectTransactionResult,
  SlotItem,
} from './types'
import { stableConfigFormJsonStringify } from '@moluoxixi/config-form-core'
import { current, Immer, isDraft } from 'immer'
import { ComponentContractRegistryError, createProjectRegistryLock } from './registry'
import {
  flowSchema,
  formSettingsSchema,
  modelJsonObjectSchema,
  pageGraphSchema,
  pageNodeSchema,
  projectPageSchema,
} from './schema'

export interface ApplyProjectTransactionOptions {
  registry?: ComponentContractRegistry
}

export type ApplyProjectDraftTransactionOptions = ApplyProjectTransactionOptions

interface NodeLocation {
  index: number
  item: SlotItem
  parentId: NodeId | null
  sequence: SlotItem[]
  slot?: string
}

interface OperationResult {
  changedProject: boolean
  inverse: ProjectOperation[]
  changedPageIds: PageId[]
  changedNodeIds: NodeId[]
  changedNodeChanges: ProjectNodeChange[]
}

interface ValidationPlan {
  pageIds: Set<PageId>
  registryNodeIdsByPage: Map<PageId, Set<NodeId>>
  registryPageIds: Set<PageId>
  registryPlacementIdsByPage: Map<PageId, Set<NodeId>>
}

const projectDocumentImmer = new Immer({ autoFreeze: false })

class TransactionError extends Error {
  readonly diagnostic: ModelDiagnostic

  constructor(diagnostic: ModelDiagnostic) {
    super(diagnostic.message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'ProjectTransactionError'
    this.diagnostic = diagnostic
  }
}

export function applyProjectTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options)
}

export function applyProjectDraftTransaction(
  document: ProjectDocument,
  transaction: ProjectTransaction,
  options: ApplyProjectDraftTransactionOptions = {},
): ProjectTransactionResult {
  return applyProjectChange(document, transaction, options)
}

/**
 * Command resolvers use this only while expanding multiple semantic actions.
 * The complete transaction must be passed through
 * applyProjectDraftTransaction or applyProjectTransaction before publication.
 *
 * @internal
 */
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
  validateDocument = true,
): ProjectTransactionResult {
  if (!transaction.id.trim() || !transaction.label.trim()) {
    return failure(document, 'PROJECT_TRANSACTION_IDENTITY_INVALID', 'Transactions require non-empty id and label values.')
  }
  if (transaction.operations.length === 0)
    return failure(document, 'PROJECT_TRANSACTION_EMPTY', 'Transactions must contain at least one operation.')
  if (options.registry) {
    try {
      validateRegistryLock(document, options.registry)
    }
    catch (error) {
      if (error instanceof TransactionError)
        return { success: false, document, diagnostics: [error.diagnostic] }
      throw error
    }
  }

  const inverseOperations: ProjectOperation[] = []
  const changedPageIds = new Set<PageId>()
  const changedNodeIds = new Set<NodeId>()
  const changedNodeChanges: ProjectNodeChange[] = []
  const validationPlan = createValidationPlan()
  let changedProject = false
  let draftCandidate: ProjectDocument

  try {
    draftCandidate = projectDocumentImmer.produce(document, (candidate) => {
      transaction.operations.forEach((operation) => {
        const result = applyOperation(candidate, operation)
        inverseOperations.unshift(...result.inverse)
        changedProject ||= result.changedProject
        result.changedPageIds.forEach(pageId => changedPageIds.add(pageId))
        result.changedNodeIds.forEach(nodeId => changedNodeIds.add(nodeId))
        changedNodeChanges.push(...result.changedNodeChanges)
        collectValidationPlan(validationPlan, operation, result)
      })
    })
  }
  catch (error) {
    if (error instanceof TransactionError)
      return { success: false, document, diagnostics: [error.diagnostic] }
    throw error
  }

  if (
    draftCandidate === document
    || (
      transaction.operations.length > 1
      && !hasSemanticChanges(document, draftCandidate, changedProject, changedPageIds)
    )
  ) {
    return {
      success: true,
      changed: false,
      document,
      inverse: { id: `${transaction.id}:inverse`, label: `Undo ${transaction.label}`, operations: [] },
      diagnostics: [],
      changedProject: false,
      changedPageIds: [],
      changedNodeIds: [],
      changedNodeChanges: [],
    }
  }

  if (options.registry) {
    let registryLock: ProjectDocument['registryLock']
    try {
      registryLock = createProjectRegistryLock(draftCandidate, options.registry)
    }
    catch (error) {
      if (error instanceof ComponentContractRegistryError) {
        return {
          success: false,
          document,
          diagnostics: [{
            code: error.code === 'MODEL_COMPONENT_UNKNOWN' ? 'PROJECT_COMPONENT_UNKNOWN' : error.code,
            message: error.message,
          }],
        }
      }
      throw error
    }
    if (!semanticallyEqual(draftCandidate.registryLock, registryLock)) {
      draftCandidate = projectDocumentImmer.produce(draftCandidate, (candidate) => {
        candidate.registryLock = structuredClone(registryLock)
      })
      changedProject = true
    }
  }

  if (validateDocument) {
    const validation = validateChangedDocument(draftCandidate, validationPlan, options.registry)
    if (validation.length > 0)
      return { success: false, document, diagnostics: validation }
  }

  const candidate = draftCandidate

  return {
    success: true,
    changed: true,
    document: candidate,
    inverse: {
      id: `${transaction.id}:inverse`,
      label: `Undo ${transaction.label}`,
      operations: inverseOperations,
    },
    diagnostics: [],
    changedProject,
    changedPageIds: [...changedPageIds],
    changedNodeIds: [...changedNodeIds],
    changedNodeChanges: normalizeNodeChanges(changedNodeChanges),
  }
}

function applyOperation(document: ProjectDocument, operation: ProjectOperation): OperationResult {
  switch (operation.type) {
    case 'page.add': {
      const parsedPage = projectPageSchema.safeParse(operation.page)
      if (!parsedPage.success) {
        invalid(
          'PROJECT_PAGE_INVALID',
          parsedPage.error.issues[0]?.message ?? 'Added page is invalid.',
          operation.page.id,
        )
      }
      const page = parsedPage.data
      if (Object.hasOwn(document.pagesById, page.id))
        invalid('PROJECT_PAGE_ID_DUPLICATE', `Page already exists: ${page.id}`, page.id)
      if (Object.values(document.pagesById).some(candidate => candidate.route === page.route))
        invalid('PROJECT_PAGE_ROUTE_DUPLICATE', `Page route already exists: ${page.route}`, page.id)
      const index = operation.index ?? document.pageOrder.length
      assertInsertIndex(index, document.pageOrder.length, 'PROJECT_PAGE_INDEX_INVALID')
      document.pagesById[page.id] = page
      document.pageOrder.splice(index, 0, page.id)
      return changed([{ type: 'page.remove', pageId: page.id }], [page.id], [], true)
    }
    case 'page.remove': {
      const page = requirePage(document, operation.pageId)
      if (document.pageOrder.length === 1)
        invalid('PROJECT_FINAL_PAGE_REMOVE', 'The final project page cannot be removed.', operation.pageId)
      const index = document.pageOrder.indexOf(operation.pageId)
      document.pageOrder.splice(index, 1)
      delete document.pagesById[operation.pageId]
      const inverse: ProjectOperation[] = [{ type: 'page.add', page: cloneModelValue(page), index }]
      if (document.homePageId === operation.pageId) {
        const previousHomePageId = document.homePageId
        document.homePageId = document.pageOrder[Math.min(index, document.pageOrder.length - 1)]!
        inverse.push({ type: 'project.home', pageId: previousHomePageId })
      }
      return changed(inverse, [operation.pageId], [], true)
    }
    case 'page.move': {
      requirePage(document, operation.pageId)
      const previousIndex = document.pageOrder.indexOf(operation.pageId)
      assertInsertIndex(operation.index, document.pageOrder.length - 1, 'PROJECT_PAGE_INDEX_INVALID')
      if (previousIndex === operation.index)
        return unchanged()
      document.pageOrder.splice(previousIndex, 1)
      document.pageOrder.splice(operation.index, 0, operation.pageId)
      return changed([{ type: 'page.move', pageId: operation.pageId, index: previousIndex }], [operation.pageId], [], true)
    }
    case 'page.rename': {
      const page = requirePage(document, operation.pageId)
      const name = operation.name.trim()
      if (!name)
        invalid('PROJECT_PAGE_NAME_INVALID', 'Page names cannot be empty.', operation.pageId)
      if (name.length > 160)
        invalid('PROJECT_PAGE_NAME_INVALID', 'Page names cannot exceed 160 characters.', operation.pageId)
      const previous = page.name
      if (previous === name)
        return unchanged()
      page.name = name
      return changed([{ type: 'page.rename', pageId: page.id, name: previous }], [page.id])
    }
    case 'page.route': {
      const page = requirePage(document, operation.pageId)
      if (!operation.route.startsWith('/') || operation.route.length > 300)
        invalid('PROJECT_PAGE_ROUTE_INVALID', 'Page routes must start with /.', operation.pageId)
      if (Object.values(document.pagesById).some(candidate => candidate.id !== page.id && candidate.route === operation.route))
        invalid('PROJECT_PAGE_ROUTE_DUPLICATE', `Page route already exists: ${operation.route}`, operation.pageId)
      const previous = page.route
      if (previous === operation.route)
        return unchanged()
      page.route = operation.route
      return changed([{ type: 'page.route', pageId: page.id, route: previous }], [page.id])
    }
    case 'project.home': {
      requirePage(document, operation.pageId)
      const previous = document.homePageId
      if (previous === operation.pageId)
        return unchanged()
      document.homePageId = operation.pageId
      return changed([{ type: 'project.home', pageId: previous }], [operation.pageId], [], true)
    }
    case 'project.settings': {
      const previous = cloneModelValue(document.settings)
      const settings = requireParsedValue(
        modelJsonObjectSchema.safeParse(operation.settings),
        'PROJECT_SETTINGS_INVALID',
        'Project settings are invalid.',
      )
      if (semanticallyEqual(previous, settings))
        return unchanged()
      document.settings = settings
      return changed([{ type: 'project.settings', settings: previous }], [], [], true)
    }
    case 'page.props': {
      const page = requirePage(document, operation.pageId)
      const previous = cloneModelValue(page.graph.props)
      const props = requireParsedValue(
        modelJsonObjectSchema.safeParse(operation.props),
        'PROJECT_PAGE_PROPS_INVALID',
        'Page properties are invalid.',
        page.id,
      )
      if (semanticallyEqual(previous, props))
        return unchanged()
      page.graph.props = props
      return changed([{ type: 'page.props', pageId: page.id, props: previous }], [page.id])
    }
    case 'page.form': {
      const page = requirePage(document, operation.pageId)
      const previous = cloneModelValue(page.graph.form)
      const form = requireParsedValue(
        formSettingsSchema.safeParse(operation.form),
        'PROJECT_PAGE_FORM_INVALID',
        'Page form settings are invalid.',
        page.id,
      )
      if (semanticallyEqual(previous, form))
        return unchanged()
      page.graph.form = form
      return changed([{ type: 'page.form', pageId: page.id, form: previous }], [page.id])
    }
    case 'node.insert': return insertSubgraph(document, operation.pageId, operation.subgraph, operation.target)
    case 'node.move': return moveNode(document, operation.pageId, operation.nodeId, operation.target)
    case 'node.props': {
      const node = requireNode(document, operation.pageId, operation.nodeId)
      const previous = cloneModelValue(node.props)
      const nextNode = parseNodeCandidate(
        { ...node, props: operation.props },
        operation.pageId,
        node.id,
      )
      if (semanticallyEqual(previous, nextNode.props))
        return unchanged()
      requirePage(document, operation.pageId).graph.nodesById[node.id] = nextNode
      return changed([{ type: 'node.props', pageId: operation.pageId, nodeId: node.id, props: previous }], [operation.pageId], [node.id])
    }
    case 'node.events': {
      const node = requireNode(document, operation.pageId, operation.nodeId)
      const previous = cloneModelValue(node.events)
      const nextNode = parseNodeCandidate(
        { ...node, events: operation.events },
        operation.pageId,
        node.id,
      )
      if (semanticallyEqual(previous, nextNode.events))
        return unchanged()
      requirePage(document, operation.pageId).graph.nodesById[node.id] = nextNode
      return changed([{ type: 'node.events', pageId: operation.pageId, nodeId: node.id, events: previous }], [operation.pageId], [node.id])
    }
    case 'node.bindings': {
      const node = requireNode(document, operation.pageId, operation.nodeId)
      const previous = cloneModelValue(node.bindings)
      const nextNode = parseNodeCandidate(
        { ...node, bindings: operation.bindings },
        operation.pageId,
        node.id,
      )
      if (semanticallyEqual(previous, nextNode.bindings))
        return unchanged()
      requirePage(document, operation.pageId).graph.nodesById[node.id] = nextNode
      return changed([{ type: 'node.bindings', pageId: operation.pageId, nodeId: node.id, bindings: previous }], [operation.pageId], [node.id])
    }
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
      return changed([{
        type: 'node.placement',
        pageId: operation.pageId,
        nodeId: operation.nodeId,
        placement: previous,
      }], [operation.pageId], [operation.nodeId])
    }
    case 'node.settings': return updateNodeSettings(document, operation)
    case 'node.remove': return removeNode(document, operation.pageId, operation.nodeId)
    case 'flow.add': {
      const page = requirePage(document, operation.pageId)
      const flows = page.flows ??= []
      const flow = requireParsedValue(
        flowSchema.safeParse(operation.flow),
        'PROJECT_FLOW_INVALID',
        'Flow is invalid.',
        page.id,
      )
      if (flows.some(candidate => candidate.id === flow.id))
        invalid('PROJECT_FLOW_ID_DUPLICATE', `Flow already exists: ${flow.id}`, operation.pageId)
      const index = operation.index ?? flows.length
      assertInsertIndex(index, flows.length, 'PROJECT_FLOW_INDEX_INVALID')
      flows.splice(index, 0, flow)
      return changed(
        [{ type: 'flow.remove', pageId: page.id, flowId: flow.id }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, undefined, flow),
      )
    }
    case 'flow.update': {
      const page = requirePage(document, operation.pageId)
      const flows = page.flows ?? []
      const index = flows.findIndex(flow => flow.id === operation.flowId)
      if (index < 0)
        invalid('PROJECT_FLOW_UNKNOWN', `Flow does not exist: ${operation.flowId}`, operation.pageId)
      const flow = requireParsedValue(
        flowSchema.safeParse(operation.flow),
        'PROJECT_FLOW_INVALID',
        'Flow is invalid.',
        page.id,
      )
      if (flow.id !== operation.flowId)
        invalid('PROJECT_FLOW_ID_CHANGE_INVALID', 'Flow update cannot change its id.', operation.pageId)
      const previous = cloneModelValue(flows[index]!)
      if (semanticallyEqual(previous, flow))
        return unchanged()
      flows[index] = flow
      return changed(
        [{ type: 'flow.update', pageId: page.id, flowId: previous.id, flow: previous }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, previous, flow),
      )
    }
    case 'flow.remove': {
      const page = requirePage(document, operation.pageId)
      const flows = page.flows ?? []
      const index = flows.findIndex(flow => flow.id === operation.flowId)
      if (index < 0)
        invalid('PROJECT_FLOW_UNKNOWN', `Flow does not exist: ${operation.flowId}`, operation.pageId)
      const [removed] = flows.splice(index, 1)
      if (flows.length === 0)
        delete page.flows
      return changed(
        [{ type: 'flow.add', pageId: page.id, flow: cloneModelValue(removed!), index }],
        [page.id],
        [],
        false,
        flowTargetChanges(page.id, removed, undefined),
      )
    }
  }
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
  const validation = pageGraphSchema.safeParse({
    version: page.graph.version,
    props: {},
    form: {},
    root: subgraph.root,
    nodesById: subgraph.nodesById,
  })
  if (!validation.success) {
    invalid('PROJECT_NODE_SUBGRAPH_INVALID', validation.error.issues[0]?.message ?? 'Inserted subgraph is invalid.', pageId)
  }
  const normalizedSubgraph: NodeSubgraph = {
    root: validation.data.root,
    nodesById: validation.data.nodesById,
  }
  const conflict = Object.keys(normalizedSubgraph.nodesById).find(nodeId => Object.hasOwn(page.graph.nodesById, nodeId))
  if (conflict)
    invalid('PROJECT_NODE_ID_DUPLICATE', `Node already exists: ${conflict}`, pageId, conflict)
  assertInsertedFieldNamesUnique(page.graph, normalizedSubgraph, pageId)

  const sequence = resolveTargetSequence(page.graph, target)
  const index = target.index ?? sequence.length
  assertInsertIndex(index, sequence.length, 'PROJECT_NODE_INDEX_INVALID')
  Object.entries(normalizedSubgraph.nodesById).forEach(([nodeId, node]) => {
    page.graph.nodesById[nodeId] = node
  })
  sequence.splice(index, 0, ...normalizedSubgraph.root)
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
  )
}

function moveNode(
  document: ProjectDocument,
  pageId: PageId,
  nodeId: NodeId,
  target: NodeTarget,
): OperationResult {
  const page = requirePage(document, pageId)
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
    events: node.events,
    bindings: node.bindings,
    ...(operation.settings.extensions ? { extensions: cloneModelValue(operation.settings.extensions) } : {}),
    ...(operation.settings.conditions ? { conditions: cloneModelValue(operation.settings.conditions) } : {}),
    ...(operation.settings.reactions ? { reactions: cloneModelValue(operation.settings.reactions) } : {}),
  }
  const nextNode = operation.settings.kind === 'layout'
    ? { ...common, kind: 'layout', slots: (node as LayoutNode).slots }
    : {
        ...common,
        kind: 'field',
        field: operation.settings.field,
        ...(operation.settings.label !== undefined ? { label: operation.settings.label } : {}),
        ...(operation.settings.defaultValue !== undefined ? { defaultValue: cloneModelValue(operation.settings.defaultValue) } : {}),
        ...(operation.settings.validation !== undefined ? { validation: cloneModelValue(operation.settings.validation) } : {}),
        ...(operation.settings.validateOn !== undefined ? { validateOn: cloneModelValue(operation.settings.validateOn) } : {}),
      }
  page.graph.nodesById[node.id] = parseNodeCandidate(nextNode, page.id, node.id)
  return changed([{ type: 'node.settings', pageId: page.id, nodeId: node.id, settings: previous }], [page.id], [node.id])
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

function validateDocumentAgainstRegistry(
  document: ProjectDocument,
  registry: ComponentContractRegistry,
  plan: ValidationPlan,
): void {
  plan.registryPageIds.forEach((pageId) => {
    const page = document.pagesById[pageId]
    if (!page)
      return
    validatePageAgainstRegistry(page, registry)
  })

  plan.registryNodeIdsByPage.forEach((nodeIds, pageId) => {
    if (plan.registryPageIds.has(pageId))
      return
    const page = document.pagesById[pageId]
    if (!page)
      return
    nodeIds.forEach((nodeId) => {
      const node = page.graph.nodesById[nodeId]
      if (!node)
        return
      const contract = requireComponentContract(registry, page, node)
      validateNodeContract(page, node, contract)
      if (node.kind === 'layout')
        validateLayoutSlots(page, node, contract, registry)
    })
  })

  plan.registryPlacementIdsByPage.forEach((nodeIds, pageId) => {
    if (plan.registryPageIds.has(pageId))
      return
    const page = document.pagesById[pageId]
    if (!page)
      return
    nodeIds.forEach(nodeId => validateNodePlacement(page, nodeId, registry))
  })
}

function validateRegistryLock(document: ProjectDocument, registry: ComponentContractRegistry): void {
  if (document.registryLock.adapter !== registry.lock.adapter) {
    invalid('PROJECT_REGISTRY_ADAPTER_MISMATCH', 'Project registry adapter does not match the active component registry.')
  }
  const usedComponents = new Set(Object.values(document.pagesById)
    .flatMap(page => Object.values(page.graph.nodesById).map(node => node.component)))
  for (const component of usedComponents) {
    const expected = document.registryLock.components[component]
    if (!expected) {
      invalid('PROJECT_REGISTRY_COMPONENT_LOCK_MISSING', `Project registry lock does not contain component: ${component}`)
    }
    const actual = registry.lock.components[component]
    if (!actual) {
      invalid('PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${component}`)
    }
    if (expected.contractVersion !== actual.contractVersion) {
      invalid(
        'PROJECT_REGISTRY_COMPONENT_VERSION_MISMATCH',
        `Component contract version does not match for ${component}: expected ${expected.contractVersion}, received ${actual.contractVersion}.`,
      )
    }
    if (expected.fingerprint !== actual.fingerprint) {
      invalid(
        'PROJECT_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
        `Component contract fingerprint does not match for ${component}.`,
      )
    }
  }
}

function validatePageAgainstRegistry(page: ProjectPage, registry: ComponentContractRegistry): void {
  const fields = new Set<string>()
  Object.values(page.graph.nodesById).forEach((node) => {
    const contract = requireComponentContract(registry, page, node)
    validateNodeContract(page, node, contract)
    if (node.kind === 'field') {
      if (fields.has(node.field))
        invalid('PROJECT_FIELD_DUPLICATE', `Field name must be unique: ${node.field}`, page.id, node.id)
      fields.add(node.field)
      return
    }
    validateLayoutSlots(page, node, contract, registry)
  })
  page.graph.root.forEach((item) => {
    const node = page.graph.nodesById[item.nodeId]
    if (!node)
      invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${item.nodeId}`, page.id, item.nodeId)
    const contract = requireComponentContract(registry, page, node)
    if (contract.allowedParents.length > 0)
      invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} requires a registered parent slot.`, page.id, node.id)
  })
  validatePageFlowTriggers(page, registry)
}

function validatePageFlowTriggers(page: ProjectPage, registry: ComponentContractRegistry): void {
  for (const flow of page.flows ?? []) {
    if (flow.trigger.kind !== 'component.event')
      continue
    const nodeId = flow.trigger.nodeId
    const eventName = flow.trigger.event
    const node = nodeId ? page.graph.nodesById[nodeId] : undefined
    if (!node)
      invalid('PROJECT_FLOW_TRIGGER_NODE_UNKNOWN', `Flow trigger node does not exist: ${nodeId ?? '<missing>'}`, page.id, nodeId)
    const contract = requireComponentContract(registry, page, node)
    if (!eventName || !contract.events.some(event => event.name === eventName)) {
      invalid(
        'PROJECT_FLOW_TRIGGER_EVENT_UNKNOWN',
        `Event is not registered for ${node.component}: ${eventName ?? '<missing>'}`,
        page.id,
        node.id,
      )
    }
  }
}

function requireComponentContract(
  registry: ComponentContractRegistry,
  page: ProjectPage,
  node: PageNode,
): ComponentContract {
  const contract = registry.get(node.component)
  if (!contract)
    invalid('PROJECT_COMPONENT_UNKNOWN', `Component is not registered: ${node.component}`, page.id, node.id)
  if (contract.kind !== node.kind)
    invalid('PROJECT_COMPONENT_KIND_INVALID', `Component kind does not match node ${node.id}.`, page.id, node.id)
  return contract
}

function validateNodeContract(page: ProjectPage, node: PageNode, contract: ComponentContract): void {
  const allowedProps = new Set([
    ...Object.keys(contract.defaults),
    ...contract.props.map(property => property.path[0] === 'props' ? property.path[1] : property.path[0]).filter(Boolean),
  ])
  const unknownProp = Object.keys(node.props).find(key => !allowedProps.has(key))
  if (unknownProp)
    invalid('PROJECT_COMPONENT_PROP_UNKNOWN', `Property is not registered for ${node.component}: ${unknownProp}`, page.id, node.id)
  const eventNames = new Set(contract.events.map(event => event.name))
  const unknownEvent = Object.keys(node.events).find(name => !eventNames.has(name))
  if (unknownEvent)
    invalid('PROJECT_COMPONENT_EVENT_UNKNOWN', `Event is not registered for ${node.component}: ${unknownEvent}`, page.id, node.id)
  const bindingNames = new Set(contract.bindings.map(binding => binding.name))
  const unknownBinding = Object.keys(node.bindings).find(name => !bindingNames.has(name))
  if (unknownBinding)
    invalid('PROJECT_COMPONENT_BINDING_UNKNOWN', `Binding is not registered for ${node.component}: ${unknownBinding}`, page.id, node.id)
}

function validateLayoutSlots(
  page: ProjectPage,
  node: LayoutNode,
  contract: ComponentContract,
  registry: ComponentContractRegistry,
): void {
  Object.entries(node.slots).forEach(([slotName, items]) => {
    const slot = contract.slots.find(candidate => candidate.name === slotName)
    if (!slot)
      invalid('PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${node.component}: ${slotName}`, page.id, node.id)
    items.forEach((item) => {
      const child = page.graph.nodesById[item.nodeId]
      if (!child)
        invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${item.nodeId}`, page.id, item.nodeId)
      if (slot.accepts && !slot.accepts.includes(child.kind))
        invalid('PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.kind}.`, page.id, child.id)
      if (slot.components && !slot.components.includes(child.component))
        invalid('PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${node.component}.${slotName} does not accept ${child.component}.`, page.id, child.id)
      const childContract = requireComponentContract(registry, page, child)
      if (
        childContract.allowedParents.length > 0
        && !childContract.allowedParents.some(parent => parent.component === node.component && parent.slot === slotName)
      ) {
        invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${child.component} is not allowed in ${node.component}.${slotName}.`, page.id, child.id)
      }
    })
  })
}

function validateNodePlacement(
  page: ProjectPage,
  nodeId: NodeId,
  registry: ComponentContractRegistry,
): void {
  const node = page.graph.nodesById[nodeId]
  if (!node)
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}`, page.id, nodeId)
  const contract = requireComponentContract(registry, page, node)
  const location = requireNodeLocation(page.graph, nodeId, page.id)
  if (location.parentId === null) {
    if (contract.allowedParents.length > 0)
      invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} requires a registered parent slot.`, page.id, node.id)
    return
  }

  const parent = page.graph.nodesById[location.parentId]
  if (!parent || parent.kind !== 'layout')
    invalid('PROJECT_TARGET_PARENT_INVALID', `Target parent is not a layout: ${location.parentId}`, page.id, location.parentId)
  const parentContract = requireComponentContract(registry, page, parent)
  const slotName = location.slot ?? 'default'
  const slot = parentContract.slots.find(candidate => candidate.name === slotName)
  if (!slot)
    invalid('PROJECT_COMPONENT_SLOT_UNKNOWN', `Slot is not registered for ${parent.component}: ${slotName}`, page.id, parent.id)
  if (slot.accepts && !slot.accepts.includes(node.kind))
    invalid('PROJECT_COMPONENT_SLOT_KIND_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.kind}.`, page.id, node.id)
  if (slot.components && !slot.components.includes(node.component))
    invalid('PROJECT_COMPONENT_SLOT_CHILD_INVALID', `Slot ${parent.component}.${slotName} does not accept ${node.component}.`, page.id, node.id)
  if (
    contract.allowedParents.length > 0
    && !contract.allowedParents.some(candidate => candidate.component === parent.component && candidate.slot === slotName)
  ) {
    invalid('PROJECT_COMPONENT_PARENT_INVALID', `Component ${node.component} is not allowed in ${parent.component}.${slotName}.`, page.id, node.id)
  }
}

function createValidationPlan(): ValidationPlan {
  return {
    pageIds: new Set(),
    registryNodeIdsByPage: new Map(),
    registryPageIds: new Set(),
    registryPlacementIdsByPage: new Map(),
  }
}

function collectValidationPlan(
  plan: ValidationPlan,
  operation: ProjectOperation,
  result: OperationResult,
): void {
  if (!result.changedProject && result.changedPageIds.length === 0 && result.changedNodeIds.length === 0)
    return

  switch (operation.type) {
    case 'project.settings':
    case 'page.props':
    case 'page.form':
      return
    case 'node.props':
    case 'node.events':
    case 'node.bindings':
    case 'node.placement': {
      const registryNodeIds = plan.registryNodeIdsByPage.get(operation.pageId) ?? new Set<NodeId>()
      registryNodeIds.add(operation.nodeId)
      plan.registryNodeIdsByPage.set(operation.pageId, registryNodeIds)
      if (operation.type === 'node.placement')
        addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, operation.nodeId)
      return
    }
    case 'page.add':
      result.changedPageIds.forEach(pageId => plan.registryPageIds.add(pageId))
      return
    case 'node.settings':
      plan.pageIds.add(operation.pageId)
      addValidationNode(plan.registryNodeIdsByPage, operation.pageId, operation.nodeId)
      addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, operation.nodeId)
      return
    case 'node.insert': {
      result.changedNodeIds.forEach(nodeId => addValidationNode(plan.registryNodeIdsByPage, operation.pageId, nodeId))
      result.inverse.forEach((inverse) => {
        if (inverse.type === 'node.remove')
          addValidationNode(plan.registryPlacementIdsByPage, operation.pageId, inverse.nodeId)
      })
      return
    }
    case 'node.remove':
      plan.pageIds.add(operation.pageId)
      break
    case 'flow.add':
    case 'flow.update':
    case 'flow.remove':
      plan.pageIds.add(operation.pageId)
      plan.registryPageIds.add(operation.pageId)
      break
    case 'node.move': {
      const nodeIds = plan.registryPlacementIdsByPage.get(operation.pageId) ?? new Set<NodeId>()
      nodeIds.add(operation.nodeId)
      plan.registryPlacementIdsByPage.set(operation.pageId, nodeIds)
      break
    }
    case 'page.remove':
    case 'page.move':
    case 'page.rename':
    case 'page.route':
    case 'project.home':
      break
  }
}

function addValidationNode(target: Map<PageId, Set<NodeId>>, pageId: PageId, nodeId: NodeId): void {
  const nodeIds = target.get(pageId) ?? new Set<NodeId>()
  nodeIds.add(nodeId)
  target.set(pageId, nodeIds)
}

function validateChangedDocument(
  document: ProjectDocument,
  plan: ValidationPlan,
  registry?: ComponentContractRegistry,
): ModelDiagnostic[] {
  for (const pageId of plan.pageIds) {
    const page = document.pagesById[pageId]
    if (!page)
      continue
    const result = projectPageSchema.safeParse(page)
    if (!result.success)
      return schemaDiagnostics(result.error.issues, ['pagesById', pageId], pageId)
  }

  if (!registry)
    return []
  try {
    validateDocumentAgainstRegistry(document, registry, plan)
    return []
  }
  catch (error) {
    if (error instanceof TransactionError)
      return [error.diagnostic]
    throw error
  }
}

function schemaDiagnostics(
  issues: Array<{ message: string, path: Array<string | number> }>,
  pathPrefix: Array<string | number>,
  pageId?: PageId,
  nodeId?: NodeId,
): ModelDiagnostic[] {
  return issues.map(issue => ({
    code: 'PROJECT_DOCUMENT_INVALID',
    message: issue.message,
    path: [...pathPrefix, ...issue.path],
    ...(pageId ? { pageId } : {}),
    ...(nodeId ? { nodeId } : {}),
  }))
}

type SchemaParseResult<T>
  = | { success: true, data: T }
    | { success: false, error: { issues: Array<{ message: string }> } }

function requireParsedValue<T>(
  result: SchemaParseResult<T>,
  code: string,
  message: string,
  pageId?: PageId,
  nodeId?: NodeId,
): T {
  if (result.success)
    return result.data
  const detail = result.error.issues[0]?.message
  invalid(code, detail ? `${message} ${detail}` : message, pageId, nodeId)
}

function parseNodeCandidate(candidate: unknown, pageId: PageId, nodeId: NodeId): PageNode {
  return requireParsedValue(
    pageNodeSchema.safeParse(candidate),
    'PROJECT_NODE_INVALID',
    'Node configuration is invalid.',
    pageId,
    nodeId,
  )
}

function settingsForNode(node: PageNode): Extract<ProjectOperation, { type: 'node.settings' }>['settings'] {
  const common = {
    component: node.component,
    ...(node.extensions ? { extensions: cloneModelValue(node.extensions) } : {}),
    ...(node.conditions ? { conditions: cloneModelValue(node.conditions) } : {}),
    ...(node.reactions ? { reactions: cloneModelValue(node.reactions) } : {}),
  }
  return node.kind === 'layout'
    ? { ...common, kind: 'layout' }
    : {
        ...common,
        kind: 'field',
        field: node.field,
        ...(node.label !== undefined ? { label: node.label } : {}),
        ...(node.defaultValue !== undefined ? { defaultValue: cloneModelValue(node.defaultValue) } : {}),
        ...(node.validation !== undefined ? { validation: cloneModelValue(node.validation) } : {}),
        ...(node.validateOn !== undefined ? { validateOn: cloneModelValue(node.validateOn) } : {}),
      }
}

function collectSubtreeIds(graph: PageGraph, rootId: NodeId, target = new Set<NodeId>()): Set<NodeId> {
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

function collectInsertedNodeChanges(
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

function collectRemovedNodeChanges(
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

function flowTargetChanges(
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

function assertInsertedFieldNamesUnique(
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

function findNodeLocation(graph: PageGraph, nodeId: NodeId): NodeLocation | undefined {
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

function requireNodeLocation(graph: PageGraph, nodeId: NodeId, pageId: PageId): NodeLocation {
  const location = findNodeLocation(graph, nodeId)
  if (!location)
    invalid('PROJECT_NODE_LOCATION_UNKNOWN', `Node has no parent location: ${nodeId}`, pageId, nodeId)
  return location
}

function resolveTargetSequence(graph: PageGraph, target: NodeTarget): SlotItem[] {
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

function requirePage(document: ProjectDocument, pageId: PageId) {
  if (!Object.hasOwn(document.pagesById, pageId))
    invalid('PROJECT_PAGE_UNKNOWN', `Page does not exist: ${pageId}`, pageId)
  return document.pagesById[pageId]!
}

function requireNode(document: ProjectDocument, pageId: PageId, nodeId: NodeId): PageNode {
  const page = requirePage(document, pageId)
  if (!Object.hasOwn(page.graph.nodesById, nodeId))
    invalid('PROJECT_NODE_UNKNOWN', `Node does not exist: ${nodeId}`, pageId, nodeId)
  return page.graph.nodesById[nodeId]!
}

function assertInsertIndex(index: number, length: number, code: string): void {
  if (!Number.isInteger(index) || index < 0 || index > length)
    invalid(code, `Insert index ${index} is outside 0..${length}.`)
}

function assertSafeRecordKey(key: string, code: string): void {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype')
    invalid(code, `Record key is not allowed: ${key}.`)
}

function hasSemanticChanges(
  previous: ProjectDocument,
  candidate: ProjectDocument,
  changedProject: boolean,
  changedPageIds: ReadonlySet<PageId>,
): boolean {
  if (changedProject) {
    const previousProjectState = {
      homePageId: previous.homePageId,
      pageOrder: previous.pageOrder,
      settings: previous.settings,
    }
    const candidateProjectState = {
      homePageId: candidate.homePageId,
      pageOrder: candidate.pageOrder,
      settings: candidate.settings,
    }
    if (!semanticallyEqual(previousProjectState, candidateProjectState))
      return true
  }

  for (const pageId of changedPageIds) {
    if (!semanticallyEqual(previous.pagesById[pageId], candidate.pagesById[pageId]))
      return true
  }
  return false
}

function semanticallyEqual(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  return stableConfigFormJsonStringify(left) === stableConfigFormJsonStringify(right)
}

function cloneModelValue<T>(value: T): T {
  const snapshot = isDraft(value) ? current(value as Draft<T>) : value
  return structuredClone(snapshot)
}

function changed(
  inverse: ProjectOperation[],
  changedPageIds: PageId[],
  changedNodeIds: NodeId[] = [],
  changedProject = false,
  changedNodeChanges: ProjectNodeChange[] = defaultNodeChanges(changedPageIds, changedNodeIds),
): OperationResult {
  return { changedProject, inverse, changedPageIds, changedNodeIds, changedNodeChanges }
}

function unchanged(): OperationResult {
  return changed([], [])
}

function defaultNodeChanges(pageIds: PageId[], nodeIds: NodeId[]): ProjectNodeChange[] {
  const pageId = pageIds.length === 1 ? pageIds[0] : undefined
  return pageId
    ? nodeIds.map(nodeId => ({ kind: 'content', pageId, nodeId }))
    : []
}

function normalizeNodeChanges(changes: ProjectNodeChange[]): ProjectNodeChange[] {
  const normalized = new Map<string, ProjectNodeChange>()
  for (const change of changes) {
    const key = `${change.pageId}\u0000${change.nodeId}`
    const previous = normalized.get(key)
    if (!previous) {
      normalized.set(key, change)
      continue
    }
    const before = previous.before ?? change.before
    const after = change.after ?? previous.after
    const kind = previous.kind === 'insert' && change.kind === 'remove'
      ? 'content'
      : previous.kind === 'remove' && change.kind === 'insert'
        ? 'move'
        : change.kind === 'content'
          ? previous.kind
          : change.kind
    normalized.set(key, {
      kind,
      pageId: change.pageId,
      nodeId: change.nodeId,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
    })
  }
  return [...normalized.values()]
}

function nodeRelation(parentId: NodeId | null, slot?: string): ProjectNodeRelation {
  return { parentId, slot: parentId === null ? null : (slot ?? 'default') }
}

function failure(document: ProjectDocument, code: string, message: string): ProjectTransactionResult {
  return { success: false, document, diagnostics: [{ code, message }] }
}

function invalid(code: string, message: string, pageId?: PageId, nodeId?: NodeId): never {
  throw new TransactionError({ code, message, ...(pageId ? { pageId } : {}), ...(nodeId ? { nodeId } : {}) })
}
