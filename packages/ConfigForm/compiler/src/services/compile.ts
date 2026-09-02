import type {
  ConfigFormFlow,
  ConfigFormFlowDiagnostic,
  ConfigFormReaction,
  ConfigFormReactionEffect,
} from '@moluoxixi/config-form-core'
import type {
  LayoutNode,
  NodeId,
  PageGraph,
  PageId,
  PageNode,
  ProjectChangeSet,
  ProjectDocument,
  ProjectDraftSnapshot,
  ProjectNodeChange,
  ProjectNodeRelation,
  ProjectPage,
  ProjectSnapshot,
  RegistryContractComponentSnapshot,
  RegistryContractSnapshot,
  SlotName,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalFlowIR,
  CanonicalNodeIR,
  CanonicalNodePlacement,
  CanonicalPageIR,
  CanonicalPageRegistryUsage,
  CanonicalProjectIR,
  CanonicalProjectIRDocument,
  CompileCanonicalPageInput,
  CompileCanonicalPageResult,
  CompileCanonicalProjectInput,
  CompileCanonicalProjectResult,
  CompileCoordinator,
  CreateCompileCoordinatorOptions,
  PageCompilation,
  PageCompilationSnapshotIdentity,
  ProjectCompilation,
  SemanticCompilerDiagnostic,
  SemanticCompilerEnvironment,
} from '../types'
import {
  analyzeConfigFormFlow,
  getConfigFormFlowSemanticHash,
} from '@moluoxixi/config-form-core'
import {
  parseProjectCompilationSnapshot,
  parseRegistryContractSnapshot,
} from '@moluoxixi/config-form-model'
import {
  CANONICAL_PROJECT_IR_VERSION,
  CONFIG_FORM_COMPILER_VERSION,
} from '../constants'
import { normalizeSemanticCompilerEnvironment } from '../schemas'
import {
  clone,
  deepFreeze,
  mergeComponentProps,
  semanticHash,
  withoutFlowPositions,
} from '../utils'

interface CompilePageContext {
  pageId: string
  graph: PageGraph
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>
  diagnostics: SemanticCompilerDiagnostic[]
  nodesById: Record<NodeId, CanonicalNodeIR>
  flowEvents: ReadonlyMap<NodeId, readonly string[]>
}

interface PreparedCompilerContext {
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>
  environment: SemanticCompilerEnvironment
  environmentHash: string
  registry: RegistryContractSnapshot
}

export function compileCanonicalProject(input: CompileCanonicalProjectInput): CompileCanonicalProjectResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const prepared = prepareCompilerContext(input.registry, input.environment)
  if (!prepared.success)
    return prepared

  const snapshot = snapshotResult.data
  const isDraft = 'kind' in snapshot
  const contentHash = isDraft ? snapshot.draftHash : snapshot.contentHash
  const project = snapshot.document as ProjectDocument
  const { contracts, environment, environmentHash, registry } = prepared.context
  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, registry, diagnostics)
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const pagesById: Record<string, CanonicalPageIR> = Object.create(null)
  project.pageOrder.forEach((pageId) => {
    const page = project.pagesById[pageId]
    if (!page)
      return
    const compiled = compilePageIR(page, contracts, diagnostics)
    if (compiled)
      pagesById[pageId] = compiled
  })
  if (diagnostics.length > 0)
    return { success: false, diagnostics }

  const base = {
    version: CANONICAL_PROJECT_IR_VERSION,
    identity: {
      projectId: project.id,
      contentHash,
      registryAdapter: registry.adapter,
      registryAdapterVersion: registry.adapterVersion,
      registryFingerprint: registry.fingerprint,
      compilerVersion: CONFIG_FORM_COMPILER_VERSION,
      environmentHash,
      irHash: '',
    },
    name: project.name,
    homePageId: project.homePageId,
    pageOrder: [...project.pageOrder],
    pagesById,
    settings: clone(project.settings),
    resources: clone(project.resources),
    environment,
  } satisfies CanonicalProjectIRDocument
  const { contentHash: _contentHash, irHash: _irHash, ...semanticIdentity } = base.identity
  base.identity.irHash = semanticHash({ ...base, identity: semanticIdentity })
  const ir = deepFreeze(base) as CanonicalProjectIR
  const compilation = deepFreeze({
    snapshot,
    registry,
    origin: isDraft
      ? {
          kind: 'draft' as const,
          baseEditVersion: snapshot.base.editVersion,
          draftId: snapshot.draftId,
        }
      : {
          kind: 'committed' as const,
          editVersion: snapshot.editVersion,
        },
    key: ir.identity,
    ir,
  }) as ProjectCompilation
  return { success: true, compilation, diagnostics: [] }
}

export function compileCanonicalPage(input: CompileCanonicalPageInput): CompileCanonicalPageResult {
  const snapshotResult = parseProjectCompilationSnapshot(input.snapshot)
  if (!snapshotResult.success)
    return { success: false, diagnostics: snapshotResult.diagnostics }
  const prepared = prepareCompilerContext(input.registry, input.environment)
  if (!prepared.success)
    return prepared
  return compilePreparedPage(snapshotResult.data, input.pageId, prepared.context)
}

function prepareCompilerContext(
  registryInput: unknown,
  environmentInput: Partial<SemanticCompilerEnvironment> | undefined,
): { success: true, context: PreparedCompilerContext } | { success: false, diagnostics: SemanticCompilerDiagnostic[] } {
  const registryResult = parseRegistryContractSnapshot(registryInput)
  if (!registryResult.success)
    return { success: false, diagnostics: registryResult.diagnostics }
  const diagnostics: SemanticCompilerDiagnostic[] = []
  const environment = normalizeSemanticCompilerEnvironment(environmentInput, diagnostics)
  if (!environment || diagnostics.length > 0)
    return { success: false, diagnostics }
  const registry = registryResult.data
  return {
    success: true,
    context: {
      contracts: new Map(registry.components.map(component => [component.key, component])),
      environment,
      environmentHash: semanticHash(environment),
      registry,
    },
  }
}

function compilePreparedPage(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  pageId: string,
  context: PreparedCompilerContext,
): CompileCanonicalPageResult {
  const project = snapshot.document as ProjectDocument
  const page = project.pagesById[pageId]
  if (!page) {
    return {
      success: false,
      diagnostics: [{
        code: 'COMPILER_PAGE_UNKNOWN',
        message: `Project does not contain page: ${pageId}`,
        pageId,
        path: ['pagesById', pageId],
      }],
    }
  }

  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, context.registry, diagnostics, [page])
  const compiledPage = compilePageIR(page, context.contracts, diagnostics)
  if (!compiledPage || diagnostics.length > 0)
    return { success: false, diagnostics }

  return {
    success: true,
    compilation: createPageCompilation(snapshot, project.id, compiledPage, context),
    diagnostics: [],
  }
}

function createPageCompilation(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  projectId: string,
  compiledPage: CanonicalPageIR,
  context: PreparedCompilerContext,
): PageCompilation {
  const registryUsage = collectPageRegistryUsage(compiledPage, context.contracts)
  const key = deepFreeze({
    irVersion: CANONICAL_PROJECT_IR_VERSION,
    projectId,
    pageId: compiledPage.id,
    registryAdapter: context.registry.adapter,
    registryAdapterVersion: context.registry.adapterVersion,
    registryUsageHash: semanticHash(registryUsage),
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: context.environmentHash,
    semanticHash: pageSemanticHash(compiledPage),
  })
  const compilation = deepFreeze({
    snapshotIdentity: pageSnapshotIdentity(snapshot, compiledPage.id),
    registryUsage,
    key,
    page: compiledPage,
  }) as PageCompilation
  return compilation
}

function pageSemanticHash(page: CanonicalPageIR): string {
  return semanticHash({
    id: page.id,
    name: page.name,
    route: page.route,
    props: page.props,
    form: page.form,
    roots: page.rootIds.map(nodeId => [nodeId, page.nodesById[nodeId]?.subtreeHash]),
    flows: page.flows,
  })
}

function collectPageRegistryUsage(
  page: CanonicalPageIR,
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>,
): CanonicalPageRegistryUsage[] {
  const keys = [...new Set(Object.values(page.nodesById).map(node => node.component))]
    .sort((left, right) => left.localeCompare(right, 'en'))
  return keys.map((key) => {
    const contract = contracts.get(key)!
    return {
      key,
      contractVersion: contract.contractVersion,
      fingerprint: contract.fingerprint,
    }
  })
}

function pageSnapshotIdentity(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  pageId: string,
): PageCompilationSnapshotIdentity {
  if ('kind' in snapshot) {
    return {
      source: 'draft',
      projectId: snapshot.base.projectId,
      pageId,
      contentHash: snapshot.draftHash,
      baseEditVersion: snapshot.base.editVersion,
      draftId: snapshot.draftId,
    }
  }
  return {
    source: 'committed',
    projectId: snapshot.document.id,
    pageId,
    contentHash: snapshot.contentHash,
    editVersion: snapshot.editVersion,
  }
}

function compilePageIR(
  page: ProjectPage,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  diagnostics: SemanticCompilerDiagnostic[],
): CanonicalPageIR | undefined {
  const { graph } = page
  const pageId = page.id
  const flows = compileFlows(page.flows ?? [], pageId, diagnostics, graph, registry)
  const flowEvents = collectFlowEvents(flows)
  const nodesById: Record<NodeId, CanonicalNodeIR> = Object.create(null)
  const context: CompilePageContext = { pageId, graph, registry, diagnostics, nodesById, flowEvents }
  graph.root.forEach(item => compileNode(context, item.nodeId, {
    parentId: null,
    slot: null,
    props: clone(item.placement),
  }))
  if (diagnostics.length > 0)
    return undefined
  return {
    id: pageId,
    name: page.name,
    route: page.route,
    props: clone(graph.props),
    form: clone(graph.form),
    rootIds: graph.root.map(item => item.nodeId),
    nodesById,
    flows,
  }
}

function compileIncrementalPreparedPage(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  pageId: string,
  context: PreparedCompilerContext,
  previous: PageCompilation,
  changes: readonly ProjectNodeChange[],
): CompileCanonicalPageResult {
  const project = snapshot.document as ProjectDocument
  const page = project.pagesById[pageId]
  if (!page)
    return compilePreparedPage(snapshot, pageId, context)

  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, context.registry, diagnostics, [page])
  const compiledPage = compileIncrementalPageIR(
    page,
    context.contracts,
    diagnostics,
    previous.page,
    changes.filter(change => change.pageId === pageId),
  )
  if (!compiledPage || diagnostics.length > 0)
    return { success: false, diagnostics }
  return {
    success: true,
    compilation: createPageCompilation(snapshot, project.id, compiledPage, context),
    diagnostics: [],
  }
}

function compileIncrementalPageIR(
  page: ProjectPage,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  diagnostics: SemanticCompilerDiagnostic[],
  previous: PageCompilation['page'],
  changes: readonly ProjectNodeChange[],
): CanonicalPageIR | undefined {
  const flows = compileFlows(page.flows ?? [], page.id, diagnostics, page.graph, registry)
  const flowEvents = collectFlowEvents(flows)
  const nodesById = Object.assign(Object.create(null) as Record<NodeId, CanonicalNodeIR>, previous.nodesById)
  const changesByNode = new Map(changes.map(change => [change.nodeId, change]))

  for (const change of changes) {
    if (change.kind === 'remove' || !page.graph.nodesById[change.nodeId])
      delete nodesById[change.nodeId]
  }

  const relationFor = (nodeId: NodeId): ProjectNodeRelation | undefined => {
    const change = changesByNode.get(nodeId)
    if (change?.after)
      return change.after
    if (change?.kind === 'remove')
      return undefined
    const placement = previous.nodesById[nodeId]?.placement
    return placement ? { parentId: placement.parentId, slot: placement.slot } : undefined
  }
  const affected = new Set<NodeId>()
  for (const change of changes) {
    if (change.kind === 'remove' || !page.graph.nodesById[change.nodeId])
      continue
    let current: NodeId | null = change.nodeId
    const visited = new Set<NodeId>()
    while (current && !visited.has(current)) {
      visited.add(current)
      affected.add(current)
      current = relationFor(current)?.parentId ?? null
    }
  }
  const depth = (nodeId: NodeId): number => {
    let value = 0
    let current = relationFor(nodeId)?.parentId ?? null
    const visited = new Set<NodeId>()
    while (current && !visited.has(current)) {
      visited.add(current)
      value += 1
      current = relationFor(current)?.parentId ?? null
    }
    return value
  }
  const compileContext: CompilePageContext = {
    pageId: page.id,
    graph: page.graph,
    registry,
    diagnostics,
    nodesById,
    flowEvents,
  }
  const ordered = [...affected].sort((left, right) => depth(right) - depth(left))
  for (const nodeId of ordered) {
    const relation = relationFor(nodeId)
    if (!relation) {
      diagnostics.push({
        code: 'COMPILER_NODE_RELATION_UNKNOWN',
        message: `Incremental compilation cannot resolve the node relation: ${nodeId}`,
        pageId: page.id,
        nodeId,
      })
      continue
    }
    const placement = resolveCanonicalPlacement(page.graph, nodeId, relation, diagnostics, page.id)
    if (!placement)
      continue
    const compiled = compileNodeShallow(compileContext, nodeId, placement)
    if (!compiled)
      continue
    const oldNode = previous.nodesById[nodeId]
    nodesById[nodeId] = oldNode?.subtreeHash === compiled.subtreeHash
      ? oldNode as unknown as CanonicalNodeIR
      : deepFreeze(compiled)
  }
  if (diagnostics.length > 0)
    return undefined
  return {
    id: page.id,
    name: page.name,
    route: page.route,
    props: clone(page.graph.props),
    form: clone(page.graph.form),
    rootIds: page.graph.root.map(item => item.nodeId),
    nodesById,
    flows,
  }
}

function resolveCanonicalPlacement(
  graph: PageGraph,
  nodeId: NodeId,
  relation: ProjectNodeRelation,
  diagnostics: SemanticCompilerDiagnostic[],
  pageId: PageId,
): CanonicalNodePlacement | undefined {
  const parent = relation.parentId === null ? undefined : graph.nodesById[relation.parentId]
  const sequence = relation.parentId === null
    ? graph.root
    : parent?.kind === 'layout'
      ? parent.slots[relation.slot ?? 'default']
      : undefined
  const item = sequence?.find(candidate => candidate.nodeId === nodeId)
  if (!item) {
    diagnostics.push({
      code: 'COMPILER_NODE_RELATION_MISMATCH',
      message: `Incremental node relation does not match the page graph: ${nodeId}`,
      pageId,
      nodeId,
    })
    return undefined
  }
  return {
    parentId: relation.parentId,
    slot: relation.parentId === null ? null : (relation.slot ?? 'default'),
    props: clone(item.placement),
  }
}

function compileNodeShallow(
  context: CompilePageContext,
  nodeId: NodeId,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR | undefined {
  const node = context.graph.nodesById[nodeId]
  const component = node ? context.registry.get(node.component) : undefined
  if (!node || !component || component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: !node
        ? 'COMPILER_NODE_UNKNOWN'
        : !component
            ? 'COMPILER_COMPONENT_UNKNOWN'
            : 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: !node
        ? `Page graph references an unknown node: ${nodeId}`
        : !component
            ? `Component is not present in the registry snapshot: ${node.component}`
            : `Component ${node.component} does not support node kind ${node.kind}.`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  const common = compileNodeBase(node, component, placement, context.flowEvents.get(node.id))
  if (node.kind === 'field') {
    const semanticNode = {
      ...common,
      kind: 'field',
      field: node.field,
      ...(node.label === undefined ? {} : { label: node.label }),
      ...(node.defaultValue === undefined ? {} : { defaultValue: clone(node.defaultValue) }),
      ...(node.validation === undefined ? {} : { validation: clone(node.validation) }),
      ...(node.validateOn === undefined ? {} : { validateOn: clone(node.validateOn) }),
    }
    return { ...semanticNode, subtreeHash: semanticHash(semanticNode) } as CanonicalNodeIR
  }

  const slots: Record<SlotName, NodeId[]> = Object.create(null)
  const childHashes: Record<SlotName, string[]> = Object.create(null)
  for (const [slotName, children] of Object.entries(node.slots)) {
    if (!validateSlot(component.contract, node, slotName, context))
      continue
    slots[slotName] = children.map(item => item.nodeId)
    childHashes[slotName] = children.flatMap((item) => {
      const child = context.nodesById[item.nodeId]
      if (child)
        return [child.subtreeHash]
      context.diagnostics.push({
        code: 'COMPILER_NODE_UNKNOWN',
        message: `Page graph references an unknown node: ${item.nodeId}`,
        pageId: context.pageId,
        nodeId: item.nodeId,
      })
      return []
    })
  }
  const semanticNode = { ...common, kind: 'layout', slots }
  return {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  } as CanonicalNodeIR
}

function compileNode(
  context: CompilePageContext,
  nodeId: NodeId,
  placement: CanonicalNodePlacement,
): CanonicalNodeIR | undefined {
  const node = context.graph.nodesById[nodeId]
  if (!node) {
    context.diagnostics.push({
      code: 'COMPILER_NODE_UNKNOWN',
      message: `Page graph references an unknown node: ${nodeId}`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  const component = context.registry.get(node.component)
  if (!component) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_UNKNOWN',
      message: `Component is not present in the registry snapshot: ${node.component}`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }
  if (component.contract.kind !== node.kind) {
    context.diagnostics.push({
      code: 'COMPILER_COMPONENT_KIND_MISMATCH',
      message: `Component ${node.component} does not support node kind ${node.kind}.`,
      pageId: context.pageId,
      nodeId,
    })
    return undefined
  }

  const common = compileNodeBase(node, component, placement, context.flowEvents.get(node.id))
  if (node.kind === 'field') {
    const semanticNode = {
      ...common,
      kind: 'field',
      field: node.field,
      ...(node.label === undefined ? {} : { label: node.label }),
      ...(node.defaultValue === undefined ? {} : { defaultValue: clone(node.defaultValue) }),
      ...(node.validation === undefined ? {} : { validation: clone(node.validation) }),
      ...(node.validateOn === undefined ? {} : { validateOn: clone(node.validateOn) }),
    }
    const compiled = {
      ...semanticNode,
      subtreeHash: semanticHash(semanticNode),
    } as CanonicalNodeIR
    context.nodesById[node.id] = compiled
    return compiled
  }

  const slots: Record<SlotName, NodeId[]> = Object.create(null)
  const childHashes: Record<SlotName, string[]> = Object.create(null)
  Object.entries(node.slots).forEach(([slotName, children]) => {
    if (!validateSlot(component.contract, node, slotName, context))
      return
    slots[slotName] = children.map(item => item.nodeId)
    childHashes[slotName] = children.flatMap((item) => {
      const child = compileNode(context, item.nodeId, {
        parentId: node.id,
        slot: slotName,
        props: clone(item.placement),
      })
      return child ? [child.subtreeHash] : []
    })
  })
  const semanticNode = { ...common, kind: 'layout', slots }
  const compiled = {
    ...semanticNode,
    subtreeHash: semanticHash({ node: semanticNode, children: childHashes }),
  } as CanonicalNodeIR
  context.nodesById[node.id] = compiled
  return compiled
}

function compileNodeBase(
  node: PageNode,
  component: RegistryContractComponentSnapshot,
  placement: CanonicalNodePlacement,
  flowEvents?: readonly string[],
) {
  return {
    id: node.id,
    component: node.component,
    componentVersion: component.contractVersion,
    componentFingerprint: component.fingerprint,
    placement,
    configuredProps: clone(node.props),
    props: mergeComponentProps(component.contract.defaults, node.props),
    events: clone(node.events),
    bindings: clone(node.bindings),
    ...(flowEvents?.length ? { flowEvents: [...flowEvents] } : {}),
    ...(node.extensions === undefined ? {} : { extensions: clone(node.extensions) }),
    ...(node.conditions === undefined ? {} : { conditions: clone(node.conditions) }),
    ...(node.reactions === undefined ? {} : { reactions: clone(node.reactions) }),
  }
}

function collectFlowEvents(flows: readonly CanonicalFlowIR[]): ReadonlyMap<NodeId, readonly string[]> {
  const eventsByNode = new Map<NodeId, Set<string>>()
  for (const flow of flows) {
    const trigger = flow.plan.trigger
    if (trigger.kind !== 'component.event' || !trigger.nodeId || !trigger.event)
      continue
    const events = eventsByNode.get(trigger.nodeId) ?? new Set<string>()
    events.add(trigger.event)
    eventsByNode.set(trigger.nodeId, events)
  }
  return new Map([...eventsByNode].map(([nodeId, events]) => [nodeId, [...events].sort()]))
}

function validateSlot(
  contract: RegistryContractComponentSnapshot['contract'],
  node: LayoutNode,
  slotName: string,
  context: CompilePageContext,
): boolean {
  if (contract.slots.some(slot => slot.name === slotName))
    return true
  context.diagnostics.push({
    code: 'COMPILER_SLOT_UNKNOWN',
    message: `Component ${node.component} does not declare slot ${slotName}.`,
    pageId: context.pageId,
    nodeId: node.id,
  })
  return false
}

function compileFlows(
  flows: ConfigFormFlow[],
  pageId: string,
  diagnostics: SemanticCompilerDiagnostic[],
  graph: PageGraph,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
): CanonicalFlowIR[] {
  const declaredReactionCapabilities = collectGraphReactionCapabilities(graph)
  return flows.flatMap((flow) => {
    const semanticFlow = withoutFlowPositions(flow)
    const result = analyzeConfigFormFlow(semanticFlow)
    if (!result.success) {
      diagnostics.push(...result.diagnostics.map(diagnostic => flowDiagnostic(pageId, diagnostic)))
      return []
    }
    if (semanticFlow.trigger.kind === 'component.event') {
      const target = semanticFlow.trigger.nodeId ? graph.nodesById[semanticFlow.trigger.nodeId] : undefined
      if (!target) {
        diagnostics.push({
          code: 'COMPILER_FLOW_TRIGGER_NODE_UNKNOWN',
          message: `Flow component.event trigger references an unknown node: ${semanticFlow.trigger.nodeId ?? '<missing>'}.`,
          pageId,
          path: ['flows', flow.id, 'trigger', 'nodeId'],
        })
        return []
      }
      const contract = registry.get(target.component)
      if (!contract || !semanticFlow.trigger.event || !contract.contract.events.some(event => event.name === semanticFlow.trigger.event)) {
        diagnostics.push({
          code: 'COMPILER_FLOW_TRIGGER_EVENT_UNKNOWN',
          message: `Flow component.event trigger references an unregistered event: ${semanticFlow.trigger.event ?? '<missing>'}.`,
          pageId,
          nodeId: target.id,
          path: ['flows', flow.id, 'trigger', 'event'],
        })
        return []
      }
    }
    const capabilityDiagnostic = diagnoseFlowCapabilityConflict(
      semanticFlow,
      graph,
      registry,
      declaredReactionCapabilities,
      pageId,
    )
    if (capabilityDiagnostic) {
      diagnostics.push(capabilityDiagnostic)
      return []
    }
    return [{
      semanticHash: getConfigFormFlowSemanticHash(semanticFlow),
      plan: result.plan,
    }]
  })
}

function diagnoseFlowCapabilityConflict(
  flow: ConfigFormFlow,
  graph: PageGraph,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  declaredReactionCapabilities: ReadonlySet<string>,
  pageId: PageId,
): SemanticCompilerDiagnostic | undefined {
  const flowCapabilities = collectFlowReactionCapabilities(flow)
  const duplicate = [...flowCapabilities].sort().find(capability => declaredReactionCapabilities.has(capability))
  if (duplicate) {
    return {
      code: 'COMPILER_FLOW_REACTION_CAPABILITY_CONFLICT',
      message: `Flow "${flow.id}" and a declarative reaction both own ${describeReactionCapability(duplicate)}. Keep synchronous state ownership in one mechanism.`,
      pageId,
      path: ['flows', flow.id, 'nodes'],
    }
  }

  const hasReaction = flow.nodes.some(node => node.type === 'reaction')
  const hasBranchOrAction = flow.nodes.some(node => node.type === 'condition' || node.type === 'action')
  if (!hasReaction || hasBranchOrAction)
    return undefined
  if (flow.trigger.kind === 'field.change') {
    return {
      code: 'COMPILER_FLOW_SYNC_REACTION_REDUNDANT',
      message: `Flow "${flow.id}" contains only synchronous form updates for field.change. Use a declarative reaction instead.`,
      pageId,
      path: ['flows', flow.id],
    }
  }
  if (flow.trigger.kind !== 'component.event' || !flow.trigger.nodeId || !flow.trigger.event)
    return undefined
  const node = graph.nodesById[flow.trigger.nodeId]
  const contract = node ? registry.get(node.component)?.contract : undefined
  const bindingEvent = contract?.bindings.some(binding => (
    Object.hasOwn(node.bindings, binding.name)
    && binding.trigger === flow.trigger.event
  ))
  if (!bindingEvent)
    return undefined
  return {
    code: 'COMPILER_FLOW_BINDING_REACTION_REDUNDANT',
    message: `Flow "${flow.id}" duplicates a bound value event with synchronous form updates. Keep the value binding and use a declarative reaction.`,
    pageId,
    nodeId: node?.id,
    path: ['flows', flow.id],
  }
}

function collectGraphReactionCapabilities(graph: PageGraph): ReadonlySet<string> {
  const capabilities = new Set<string>()
  for (const node of Object.values(graph.nodesById))
    collectReactionCapabilities(node.reactions ?? [], capabilities)
  return capabilities
}

function collectFlowReactionCapabilities(flow: ConfigFormFlow): ReadonlySet<string> {
  const capabilities = new Set<string>()
  for (const node of flow.nodes) {
    if (node.type !== 'reaction' || !Array.isArray(node.config?.reactions))
      continue
    collectReactionCapabilities(node.config.reactions as unknown as ConfigFormReaction[], capabilities)
  }
  return capabilities
}

function collectReactionCapabilities(
  reactions: readonly ConfigFormReaction[],
  capabilities: Set<string>,
): void {
  for (const reaction of reactions) {
    if (reaction.enabled === false)
      continue
    for (const effect of [...reaction.then, ...(reaction.else ?? [])])
      collectReactionEffectCapabilities(effect, capabilities)
  }
}

function collectReactionEffectCapabilities(
  effect: ConfigFormReactionEffect,
  capabilities: Set<string>,
): void {
  if (effect.kind === 'setValue' || effect.kind === 'clearValue') {
    capabilities.add(`value:${effect.target}`)
    return
  }
  if (effect.kind === 'validate') {
    capabilities.add(`validate:${effect.target}`)
    return
  }
  const values = effect.kind === 'setProps' ? effect.props : effect.state
  const family = effect.kind === 'setProps' ? 'prop' : 'state'
  for (const key of Object.keys(values))
    capabilities.add(`${family}:${effect.target}:${key}`)
}

function describeReactionCapability(capability: string): string {
  const [family, target, key] = capability.split(':')
  if (family === 'value')
    return `the value of field "${target}"`
  if (family === 'validate')
    return `validation of field "${target}"`
  return `${family} "${key}" of field "${target}"`
}

function flowDiagnostic(pageId: string, diagnostic: ConfigFormFlowDiagnostic): SemanticCompilerDiagnostic {
  return {
    code: diagnostic.code,
    message: diagnostic.message,
    pageId,
    ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    ...(diagnostic.path ? { path: diagnostic.path.split('.') } : {}),
  }
}

function validateRegistryLock(
  project: ProjectDocument,
  registry: RegistryContractSnapshot,
  diagnostics: SemanticCompilerDiagnostic[],
  pages: readonly ProjectPage[] = Object.values(project.pagesById),
): void {
  if (project.registryLock.adapter !== registry.adapter) {
    diagnostics.push({
      code: 'COMPILER_REGISTRY_ADAPTER_MISMATCH',
      message: 'Project registry adapter does not match the compiler registry snapshot.',
      path: ['registryLock', 'adapter'],
    })
    return
  }

  const contracts = new Map(registry.components.map(component => [component.key, component]))
  const usedComponents = new Map<string, { nodeId: string, pageId: string }>()
  pages.forEach((page) => {
    Object.values(page.graph.nodesById).forEach((node) => {
      if (!usedComponents.has(node.component))
        usedComponents.set(node.component, { nodeId: node.id, pageId: page.id })
    })
  })
  for (const [component, location] of [...usedComponents].sort(([left], [right]) => left.localeCompare(right))) {
    const expected = project.registryLock.components[component]
    const actual = contracts.get(component)
    if (!expected) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_LOCK_MISSING',
        message: `Project registry lock does not contain component: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (!actual) {
      diagnostics.push({
        code: 'COMPILER_COMPONENT_UNKNOWN',
        message: `Component is not present in the registry snapshot: ${component}`,
        ...location,
        path: ['registryLock', 'components', component],
      })
      continue
    }
    if (expected.contractVersion !== actual.contractVersion) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_VERSION_MISMATCH',
        message: `Component contract version does not match for ${component}: expected ${expected.contractVersion}, received ${actual.contractVersion}.`,
        ...location,
        path: ['registryLock', 'components', component, 'contractVersion'],
      })
    }
    if (expected.fingerprint !== actual.fingerprint) {
      diagnostics.push({
        code: 'COMPILER_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH',
        message: `Component contract fingerprint does not match for ${component}.`,
        ...location,
        path: ['registryLock', 'components', component, 'fingerprint'],
      })
    }
  }
}

export function createCompileCoordinator(
  options: CreateCompileCoordinatorOptions,
): CompileCoordinator {
  const maxCachedPages = options.maxCachedPages ?? 32
  if (!Number.isInteger(maxCachedPages) || maxCachedPages < 1)
    throw new RangeError('CompileCoordinator maxCachedPages must be a positive integer.')

  const prepared = prepareCompilerContext(options.registry, options.environment)
  const context = prepared.success ? prepared.context : undefined
  const contextDiagnostics = prepared.success ? [] : prepared.diagnostics
  const committedCache = new Map<string, PageCompilation>()
  const draftCache = new Map<string, PageCompilation>()
  const dirtyPages = new Set<string>()
  const pendingNodeChanges = new Map<string, readonly ProjectNodeChange[]>()
  let currentSnapshot: ProjectSnapshot | undefined

  function invalidContextResult(): CompileCanonicalPageResult | undefined {
    return context
      ? undefined
      : { success: false, diagnostics: structuredClone(contextDiagnostics) }
  }

  function touchCache(
    cache: Map<string, PageCompilation>,
    key: string,
    compilation: PageCompilation,
  ): void {
    cache.delete(key)
    cache.set(key, compilation)
    while (cache.size > maxCachedPages) {
      const oldest = cache.keys().next().value
      if (oldest === undefined)
        break
      cache.delete(oldest)
      if (cache === committedCache)
        dirtyPages.delete(oldest)
    }
  }

  function markAllCommittedDirty(): void {
    committedCache.forEach((_compilation, pageId) => {
      dirtyPages.add(pageId)
      pendingNodeChanges.delete(pageId)
    })
  }

  function registryUsageMatchesSnapshot(
    compilation: PageCompilation,
    snapshot: ProjectSnapshot,
  ): boolean {
    if (!context || snapshot.document.registryLock.adapter !== context.registry.adapter)
      return false
    return compilation.registryUsage.every((usage) => {
      const locked = snapshot.document.registryLock.components[usage.key]
      return locked?.contractVersion === usage.contractVersion
        && locked.fingerprint === usage.fingerprint
    })
  }

  function acceptSnapshot(snapshot: ProjectSnapshot, changeSet?: ProjectChangeSet): void {
    const previous = currentSnapshot
    if (previous
      && previous.document.id === snapshot.document.id
      && previous.editVersion === snapshot.editVersion
      && previous.contentHash === snapshot.contentHash) {
      currentSnapshot = snapshot
      return
    }

    if (!previous || previous.document.id !== snapshot.document.id) {
      committedCache.clear()
      draftCache.clear()
      dirtyPages.clear()
      pendingNodeChanges.clear()
    }
    else {
      committedCache.forEach((_compilation, pageId) => {
        if (!snapshot.document.pagesById[pageId]) {
          committedCache.delete(pageId)
          dirtyPages.delete(pageId)
          pendingNodeChanges.delete(pageId)
        }
      })

      const adjacent = snapshot.editVersion === previous.editVersion + 1
      const describesChange = !!changeSet
        && (changeSet.project || changeSet.pageIds.length > 0 || changeSet.nodeIds.length > 0)
      const pageAttributionMissing = !!changeSet
        && !changeSet.project
        && changeSet.pageIds.length === 0
      const precise = !!changeSet && Array.isArray(changeSet.nodeChanges)
      if (!adjacent || !describesChange || pageAttributionMissing || !precise) {
        markAllCommittedDirty()
      }
      else {
        changeSet.pageIds.forEach((pageId) => {
          dirtyPages.add(pageId)
          pendingNodeChanges.set(
            pageId,
            changeSet.nodeChanges.filter(change => change.pageId === pageId),
          )
        })
        if (changeSet.project) {
          committedCache.forEach((compilation, pageId) => {
            if (!registryUsageMatchesSnapshot(compilation, snapshot)) {
              dirtyPages.add(pageId)
              pendingNodeChanges.delete(pageId)
            }
          })
        }
      }
      draftCache.clear()
    }
    currentSnapshot = snapshot
  }

  function compilePage(pageId: string): CompileCanonicalPageResult {
    const contextFailure = invalidContextResult()
    if (contextFailure)
      return contextFailure
    if (!currentSnapshot) {
      return {
        success: false,
        diagnostics: [{
          code: 'COMPILER_COORDINATOR_SNAPSHOT_REQUIRED',
          message: 'CompileCoordinator requires an accepted committed snapshot.',
          pageId,
        }],
      }
    }

    const cached = committedCache.get(pageId)
    if (cached && !dirtyPages.has(pageId)) {
      const rebound = rebindPageCompilation(cached, currentSnapshot, pageId)
      touchCache(committedCache, pageId, rebound)
      return { success: true, compilation: rebound, diagnostics: [] }
    }

    const result = cached && pendingNodeChanges.has(pageId)
      ? compileIncrementalPreparedPage(
          currentSnapshot,
          pageId,
          context!,
          cached,
          pendingNodeChanges.get(pageId)!,
        )
      : compilePreparedPage(currentSnapshot, pageId, context!)
    if (!result.success)
      return result
    const compilation = cached && samePageCompilationKey(cached, result.compilation)
      ? rebindPageCompilation(cached, currentSnapshot, pageId)
      : result.compilation
    dirtyPages.delete(pageId)
    pendingNodeChanges.delete(pageId)
    touchCache(committedCache, pageId, compilation)
    return { success: true, compilation, diagnostics: [] }
  }

  function compileDraftPage(
    snapshot: ProjectDraftSnapshot,
    pageId: string,
    changeSet?: ProjectChangeSet,
  ): CompileCanonicalPageResult {
    const contextFailure = invalidContextResult()
    if (contextFailure)
      return contextFailure
    if (!currentSnapshot
      || snapshot.base.projectId !== currentSnapshot.document.id
      || snapshot.base.editVersion !== currentSnapshot.editVersion
      || snapshot.base.contentHash !== currentSnapshot.contentHash) {
      return {
        success: false,
        diagnostics: [{
          code: 'COMPILER_DRAFT_BASE_STALE',
          message: 'Draft compilation requires the current committed snapshot as its base.',
          pageId,
        }],
      }
    }

    const cacheKey = `${snapshot.base.projectId}:${snapshot.base.editVersion}:${pageId}:${snapshot.draftHash}`
    const cached = draftCache.get(cacheKey)
    if (cached) {
      touchCache(draftCache, cacheKey, cached)
      return { success: true, compilation: cached, diagnostics: [] }
    }

    const committed = committedCache.get(pageId)
    const precise = !!changeSet
      && Array.isArray(changeSet.nodeChanges)
      && changeSet.pageIds.includes(pageId)
    const result = committed && precise
      ? compileIncrementalPreparedPage(snapshot, pageId, context!, committed, changeSet.nodeChanges)
      : compilePreparedPage(snapshot, pageId, context!)
    if (!result.success)
      return result
    const semanticMatch = [...draftCache.values()].find(candidate => (
      samePageCompilationKey(candidate, result.compilation)
    ))
    const compilation = semanticMatch
      ? rebindPageCompilation(semanticMatch, snapshot, pageId)
      : result.compilation
    touchCache(draftCache, cacheKey, compilation)
    return { success: true, compilation, diagnostics: [] }
  }

  return {
    acceptSnapshot,
    clear() {
      currentSnapshot = undefined
      committedCache.clear()
      draftCache.clear()
      dirtyPages.clear()
      pendingNodeChanges.clear()
    },
    compileDraftPage,
    compilePage,
  }
}

function samePageCompilationKey(left: PageCompilation, right: PageCompilation): boolean {
  const leftKey = left.key
  const rightKey = right.key
  return leftKey.irVersion === rightKey.irVersion
    && leftKey.projectId === rightKey.projectId
    && leftKey.pageId === rightKey.pageId
    && leftKey.registryAdapter === rightKey.registryAdapter
    && leftKey.registryAdapterVersion === rightKey.registryAdapterVersion
    && leftKey.registryUsageHash === rightKey.registryUsageHash
    && leftKey.compilerVersion === rightKey.compilerVersion
    && leftKey.environmentHash === rightKey.environmentHash
    && leftKey.semanticHash === rightKey.semanticHash
}

function rebindPageCompilation(
  compilation: PageCompilation,
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  pageId: string,
): PageCompilation {
  const snapshotIdentity = pageSnapshotIdentity(snapshot, pageId)
  if (samePageSnapshotIdentity(compilation.snapshotIdentity, snapshotIdentity))
    return compilation
  return deepFreeze({
    snapshotIdentity,
    registryUsage: compilation.registryUsage,
    key: compilation.key,
    page: compilation.page,
  }) as PageCompilation
}

function samePageSnapshotIdentity(
  left: PageCompilationSnapshotIdentity,
  right: PageCompilationSnapshotIdentity,
): boolean {
  if (left.source !== right.source)
    return false
  if (left.projectId !== right.projectId
    || left.pageId !== right.pageId
    || left.contentHash !== right.contentHash) {
    return false
  }
  return left.source === 'committed' && right.source === 'committed'
    ? left.editVersion === right.editVersion
    : left.source === 'draft' && right.source === 'draft'
      && left.baseEditVersion === right.baseEditVersion
      && left.draftId === right.draftId
}
