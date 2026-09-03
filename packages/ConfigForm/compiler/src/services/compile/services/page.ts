import type {
  NodeId,
  ProjectDocument,
  ProjectDraftSnapshot,
  ProjectNodeChange,
  ProjectNodeRelation,
  ProjectPage,
  ProjectSnapshot,
  RegistryContractComponentSnapshot,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalNodeIR,
  CanonicalPageIR,
  CanonicalPageRegistryUsage,
  CompileCanonicalPageResult,
  PageCompilation,
  PageCompilationSnapshotIdentity,
  SemanticCompilerDiagnostic,
} from '../../../types'
import type { CompilePageContext, PreparedCompilerContext } from '../types'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '../../../constants'
import { clone, deepFreeze, semanticHash } from '../../../utils'
import { validateRegistryLock } from '../validation'
import { collectFlowEvents, compileFlows } from './flows'
import { compileNode, compileNodeShallow, resolveCanonicalPlacement } from './node'

export function compilePreparedPage(
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
  return deepFreeze({
    snapshotIdentity: pageSnapshotIdentity(snapshot, compiledPage.id),
    registryUsage,
    key,
    page: compiledPage,
  }) as PageCompilation
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

export function pageSnapshotIdentity(
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

export function compilePageIR(
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

export function compileIncrementalPreparedPage(
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
