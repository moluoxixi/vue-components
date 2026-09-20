import type {
  DeepReadonly,
  NodeId,
  ProjectDataset,
  ProjectDraftSnapshot,
  ProjectNodeChange,
  ProjectNodeRelation,
  ProjectSnapshot,
  ProjectSurface,
  ReadonlyProjectDocument,
  RegistryContractComponentSnapshot,
  SurfaceGraph,
  SurfaceId,
} from '@moluoxixi/config-form-model'
import type {
  CanonicalNodeIR,
  CanonicalSurfaceIR,
  CanonicalSurfaceRegistryUsage,
  CompileCanonicalSurfaceResult,
  SemanticCompilerDiagnostic,
  SurfaceCompilation,
  SurfaceCompilationSnapshotIdentity,
} from '../../../types'
import type { CompileSurfaceContext, PreparedCompilerContext } from '../types'
import { deriveSurfaceValueSchema } from '@moluoxixi/config-form-model'
import { CANONICAL_PROJECT_IR_VERSION, CONFIG_FORM_COMPILER_VERSION } from '../../../constants'
import { clone, deepFreeze, semanticHash } from '../../../utils'
import { validateRegistryLock } from '../validation'
import { compileNode, compileNodeShallow, resolveCanonicalPlacement } from './node'

type ReadonlyProjectSurface = DeepReadonly<ProjectSurface>

export function compilePreparedSurface(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  surfaceId: SurfaceId,
  context: PreparedCompilerContext,
): CompileCanonicalSurfaceResult {
  const project = snapshot.document
  const surface = project.surfacesById[surfaceId]
  if (!surface) {
    return {
      success: false,
      diagnostics: [{
        code: 'COMPILER_SURFACE_UNKNOWN',
        message: `Project does not contain Surface: ${surfaceId}`,
        surfaceId,
        path: ['surfacesById', surfaceId],
      }],
    }
  }

  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, context.registry, diagnostics, [surface])
  const compiledSurface = compileSurfaceIR(surface, context.contracts, diagnostics)
  if (!compiledSurface || diagnostics.length > 0)
    return { success: false, diagnostics }

  return {
    success: true,
    compilation: createSurfaceCompilation(snapshot, project, compiledSurface, context),
    diagnostics: [],
  }
}

function createSurfaceCompilation(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  project: ReadonlyProjectDocument,
  compiledSurface: CanonicalSurfaceIR,
  context: PreparedCompilerContext,
  previous?: SurfaceCompilation,
): SurfaceCompilation {
  const registryUsage = previous?.surface.nodesById === compiledSurface.nodesById
    ? previous.registryUsage
    : collectSurfaceRegistryUsage(compiledSurface, context.contracts)
  const key = deepFreeze({
    irVersion: CANONICAL_PROJECT_IR_VERSION,
    projectId: project.id,
    surfaceId: compiledSurface.id,
    registryAdapter: context.registry.adapter,
    registryAdapterVersion: context.registry.adapterVersion,
    registryUsageHash: semanticHash(registryUsage),
    compilerVersion: CONFIG_FORM_COMPILER_VERSION,
    environmentHash: context.environmentHash,
    semanticHash: surfaceSemanticHash(compiledSurface, project),
  })
  return deepFreeze({
    snapshotIdentity: surfaceSnapshotIdentity(snapshot, compiledSurface.id),
    registryUsage,
    key,
    surface: compiledSurface,
    theme: clone(project.theme),
    datasetsById: collectSurfaceDatasets(compiledSurface, project),
  }) as SurfaceCompilation
}

function collectSurfaceDatasets(
  surface: CanonicalSurfaceIR,
  project: ReadonlyProjectDocument,
): Record<string, DeepReadonly<ProjectDataset>> {
  const datasetIds = new Set<string>()
  Object.values(surface.nodesById).forEach((node) => {
    Object.values(node.datasetBindings ?? {}).forEach(binding => datasetIds.add(binding.datasetId))
  })
  return Object.fromEntries([...datasetIds]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .flatMap((id) => {
      const dataset = project.datasetsById[id]
      return dataset ? [[id, clone(dataset)] as const] : []
    }))
}

function surfaceSemanticHash(surface: CanonicalSurfaceIR, project: ReadonlyProjectDocument): string {
  const datasetIds = new Set<string>()
  const resourceIds = new Set<string>()
  Object.values(surface.nodesById).forEach((node) => {
    Object.values(node.datasetBindings ?? {}).forEach(binding => datasetIds.add(binding.datasetId))
    Object.values(node.resourceBindings ?? {}).forEach(binding => resourceIds.add(binding.resourceId))
  })
  const datasets = [...datasetIds]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(id => [id, project.datasetsById[id]])
  const resources = [...resourceIds]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map(id => [id, project.resources[id]])
  return semanticHash({
    id: surface.id,
    name: surface.name,
    kind: surface.kind,
    ...surface.kind === 'page'
      ? { route: surface.route }
      : { presentation: surface.presentation },
    props: surface.props,
    form: surface.form,
    roots: surface.rootIds.map(nodeId => [nodeId, surface.nodesById[nodeId]?.subtreeHash]),
    parameters: surface.parameters,
    outputs: surface.outputs,
    interactions: surface.interactions,
    valueScopes: surface.valueScopes,
    scopedFields: surface.scopedFields,
    datasets,
    resources,
  })
}

function collectSurfaceRegistryUsage(
  surface: CanonicalSurfaceIR,
  contracts: ReadonlyMap<string, RegistryContractComponentSnapshot>,
): CanonicalSurfaceRegistryUsage[] {
  const keys = [...new Set(Object.values(surface.nodesById).map(node => node.component))]
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

export function surfaceSnapshotIdentity(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  surfaceId: SurfaceId,
): SurfaceCompilationSnapshotIdentity {
  if ('kind' in snapshot) {
    return {
      source: 'draft',
      projectId: snapshot.base.projectId,
      surfaceId,
      contentHash: snapshot.draftHash,
      baseEditVersion: snapshot.base.editVersion,
      draftId: snapshot.draftId,
    }
  }
  return {
    source: 'committed',
    projectId: snapshot.document.id,
    surfaceId,
    contentHash: snapshot.contentHash,
    editVersion: snapshot.editVersion,
  }
}

export function compileSurfaceIR(
  surface: ReadonlyProjectSurface,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  diagnostics: SemanticCompilerDiagnostic[],
): CanonicalSurfaceIR | undefined {
  const { graph } = surface
  const valueSchema = deriveSurfaceValueSchema(graph as unknown as SurfaceGraph)
  const nodesById: Record<NodeId, CanonicalNodeIR> = Object.create(null)
  const context: CompileSurfaceContext = {
    surfaceId: surface.id,
    graph,
    registry,
    diagnostics,
    nodesById,
  }
  graph.root.forEach(item => compileNode(context, item.nodeId, {
    parentId: null,
    slot: null,
    props: clone(item.placement),
  }))
  if (diagnostics.length > 0)
    return undefined
  return createCanonicalSurface(surface, nodesById, valueSchema)
}

export function compileIncrementalPreparedSurface(
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  surfaceId: SurfaceId,
  context: PreparedCompilerContext,
  previous: SurfaceCompilation,
  changes: readonly ProjectNodeChange[],
): CompileCanonicalSurfaceResult {
  const project = snapshot.document
  const surface = project.surfacesById[surfaceId]
  if (!surface)
    return compilePreparedSurface(snapshot, surfaceId, context)

  const diagnostics: SemanticCompilerDiagnostic[] = []
  validateRegistryLock(project, context.registry, diagnostics, [surface])
  const compiledSurface = compileIncrementalSurfaceIR(
    surface,
    context.contracts,
    diagnostics,
    previous.surface,
    changes.filter(change => change.surfaceId === surfaceId),
  )
  if (!compiledSurface || diagnostics.length > 0)
    return { success: false, diagnostics }
  return {
    success: true,
    compilation: createSurfaceCompilation(snapshot, project, compiledSurface, context, previous),
    diagnostics: [],
  }
}

function compileIncrementalSurfaceIR(
  surface: ReadonlyProjectSurface,
  registry: ReadonlyMap<string, RegistryContractComponentSnapshot>,
  diagnostics: SemanticCompilerDiagnostic[],
  previous: SurfaceCompilation['surface'],
  changes: readonly ProjectNodeChange[],
): CanonicalSurfaceIR | undefined {
  const canonicalChanges = changes.filter(affectsCanonicalNodes)
  const nodesById: Record<NodeId, CanonicalNodeIR> = canonicalChanges.length === 0
    ? previous.nodesById as unknown as Record<NodeId, CanonicalNodeIR>
    : Object.assign(Object.create(null) as Record<NodeId, CanonicalNodeIR>, previous.nodesById)
  const changesByNode = new Map(canonicalChanges.map(change => [change.nodeId, change]))

  for (const change of canonicalChanges) {
    if (change.kind === 'remove' || !surface.graph.nodesById[change.nodeId])
      delete nodesById[change.nodeId]
  }

  const currentRelationFor = (nodeId: NodeId): ProjectNodeRelation | undefined => {
    const change = changesByNode.get(nodeId)
    if (change?.after)
      return change.after
    if (change?.kind === 'remove')
      return undefined
    const placement = previous.nodesById[nodeId]?.placement
    return placement ? { parentId: placement.parentId, slot: placement.slot } : undefined
  }
  const previousRelationFor = (nodeId: NodeId): ProjectNodeRelation | undefined => {
    const placement = previous.nodesById[nodeId]?.placement
    return placement ? { parentId: placement.parentId, slot: placement.slot } : undefined
  }
  const affected = new Set<NodeId>()
  const markAncestors = (
    start: NodeId | null | undefined,
    relationFor: (nodeId: NodeId) => ProjectNodeRelation | undefined,
  ): void => {
    let current = start ?? null
    const visited = new Set<NodeId>()
    while (current && !visited.has(current)) {
      visited.add(current)
      if (surface.graph.nodesById[current])
        affected.add(current)
      current = relationFor(current)?.parentId ?? null
    }
  }
  for (const change of canonicalChanges) {
    if (change.kind !== 'remove' && surface.graph.nodesById[change.nodeId])
      markAncestors(change.nodeId, currentRelationFor)
    markAncestors(change.before?.parentId, previousRelationFor)
    markAncestors(change.after?.parentId, currentRelationFor)
  }
  const depth = (nodeId: NodeId): number => {
    let value = 0
    let current = currentRelationFor(nodeId)?.parentId ?? null
    const visited = new Set<NodeId>()
    while (current && !visited.has(current)) {
      visited.add(current)
      value += 1
      current = currentRelationFor(current)?.parentId ?? null
    }
    return value
  }
  const compileContext: CompileSurfaceContext = {
    surfaceId: surface.id,
    graph: surface.graph,
    registry,
    diagnostics,
    nodesById,
  }
  const ordered = [...affected].sort((left, right) => depth(right) - depth(left))
  for (const nodeId of ordered) {
    const relation = currentRelationFor(nodeId)
    if (!relation) {
      diagnostics.push({
        code: 'COMPILER_NODE_RELATION_UNKNOWN',
        message: `Incremental compilation cannot resolve the node relation: ${nodeId}`,
        surfaceId: surface.id,
        nodeId,
      })
      continue
    }
    const placement = resolveCanonicalPlacement(surface.graph, nodeId, relation, diagnostics, surface.id)
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
  const valueSchema = incrementalValueSchema(surface, previous, changes)
  return createCanonicalSurface(surface, nodesById, valueSchema)
}

function createCanonicalSurface(
  surface: ReadonlyProjectSurface,
  nodesById: Record<NodeId, CanonicalNodeIR>,
  valueSchema: ReturnType<typeof deriveSurfaceValueSchema>,
): CanonicalSurfaceIR {
  const common = {
    id: surface.id,
    name: surface.name,
    kind: surface.kind,
    props: clone(surface.graph.props),
    form: clone(surface.graph.form),
    rootIds: surface.graph.root.map(item => item.nodeId),
    nodesById,
    parameters: clone(surface.parameters),
    outputs: clone(surface.outputs),
    interactions: clone(surface.interactions),
    valueScopes: valueSchema.valueScopes,
    scopedFields: valueSchema.scopedFields,
  }
  switch (surface.kind) {
    case 'page':
      return { ...common, kind: 'page', route: surface.route }
    case 'dialog':
      return { ...common, kind: 'dialog', presentation: clone(surface.presentation) }
    case 'drawer':
      return { ...common, kind: 'drawer', presentation: clone(surface.presentation) }
  }
}

function affectsCanonicalNodes(change: ProjectNodeChange): boolean {
  if (change.kind !== 'move' || !change.before || !change.after)
    return true
  return change.before.parentId !== change.after.parentId
    || change.before.slot !== change.after.slot
}

function incrementalValueSchema(
  surface: ReadonlyProjectSurface,
  previous: SurfaceCompilation['surface'],
  changes: readonly ProjectNodeChange[],
): Pick<CanonicalSurfaceIR, 'scopedFields' | 'valueScopes'> {
  const changed = changes.some((change) => {
    if (change.kind === 'move')
      return previous.valueScopes.length > 0
    if (change.before && change.after)
      return true
    if (change.kind !== 'content')
      return true
    const source = surface.graph.nodesById[change.nodeId]
    const compiled = previous.nodesById[change.nodeId]
    if (!source || !compiled || source.kind !== compiled.kind)
      return true
    if (source.kind === 'field' && compiled.kind === 'field')
      return semanticHash([source.field, source.defaultValue]) !== semanticHash([compiled.field, compiled.defaultValue])
    if (source.kind === 'layout' && compiled.kind === 'layout')
      return semanticHash(source.valueScope ?? null) !== semanticHash(compiled.valueScope ?? null)
    return false
  })
  if (changed)
    return deriveSurfaceValueSchema(surface.graph as unknown as SurfaceGraph)
  return {
    scopedFields: previous.scopedFields as unknown as CanonicalSurfaceIR['scopedFields'],
    valueScopes: previous.valueScopes as unknown as CanonicalSurfaceIR['valueScopes'],
  }
}
