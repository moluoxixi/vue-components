import type {
  ProjectChangeSet,
  ProjectDraftSnapshot,
  ProjectNodeChange,
  ProjectSnapshot,
  ReadonlyProjectDocument,
  SurfaceId,
} from '@moluoxixi/config-form-model'
import type {
  CompileCanonicalSurfaceResult,
  CompileCoordinator,
  CreateCompileCoordinatorOptions,
  SurfaceCompilation,
  SurfaceCompilationSnapshotIdentity,
} from '../../../types'
import { clone, deepFreeze } from '../../../utils'
import { prepareCompilerContext } from './context'
import {
  compileIncrementalPreparedSurface,
  compilePreparedSurface,
  surfaceSnapshotIdentity,
} from './surface'

export function createCompileCoordinator(
  options: CreateCompileCoordinatorOptions,
): CompileCoordinator {
  const maxCachedSurfaces = options.maxCachedSurfaces ?? 32
  if (!Number.isInteger(maxCachedSurfaces) || maxCachedSurfaces < 1)
    throw new RangeError('CompileCoordinator maxCachedSurfaces must be a positive integer.')

  const prepared = prepareCompilerContext(options.registry, options.environment)
  const context = prepared.success ? prepared.context : undefined
  const contextDiagnostics = prepared.success ? [] : prepared.diagnostics
  const committedCache = new Map<SurfaceId, SurfaceCompilation>()
  const draftCache = new Map<string, SurfaceCompilation>()
  const dirtySurfaces = new Set<SurfaceId>()
  const pendingNodeChanges = new Map<SurfaceId, readonly ProjectNodeChange[]>()
  let currentSnapshot: ProjectSnapshot | undefined

  function invalidContextResult(): CompileCanonicalSurfaceResult | undefined {
    return context
      ? undefined
      : { success: false, diagnostics: structuredClone(contextDiagnostics) }
  }

  function touchCache(
    cache: Map<string, SurfaceCompilation>,
    key: string,
    compilation: SurfaceCompilation,
  ): void {
    cache.delete(key)
    cache.set(key, compilation)
    while (cache.size > maxCachedSurfaces) {
      const oldest = cache.keys().next().value
      if (oldest === undefined)
        break
      cache.delete(oldest)
      if (cache === committedCache)
        dirtySurfaces.delete(oldest)
    }
  }

  function markDirty(surfaceId: SurfaceId, nodeChanges?: readonly ProjectNodeChange[]): void {
    if (!committedCache.has(surfaceId))
      return
    dirtySurfaces.add(surfaceId)
    if (nodeChanges)
      pendingNodeChanges.set(surfaceId, nodeChanges)
    else
      pendingNodeChanges.delete(surfaceId)
  }

  function markAllCommittedDirty(): void {
    committedCache.forEach((_compilation, surfaceId) => markDirty(surfaceId))
  }

  function registryUsageMatchesSnapshot(
    compilation: SurfaceCompilation,
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
      dirtySurfaces.clear()
      pendingNodeChanges.clear()
    }
    else {
      committedCache.forEach((_compilation, surfaceId) => {
        if (!snapshot.document.surfacesById[surfaceId]) {
          committedCache.delete(surfaceId)
          dirtySurfaces.delete(surfaceId)
          pendingNodeChanges.delete(surfaceId)
        }
      })

      const adjacent = snapshot.editVersion === previous.editVersion + 1
      const describesChange = !!changeSet && hasChanges(changeSet)
      if (!adjacent || !describesChange) {
        markAllCommittedDirty()
      }
      else {
        const affected = affectedSurfaceIds(previous.document, snapshot.document, changeSet)
        affected.forEach((surfaceId) => {
          const nodeChanges = changeSet.nodeChanges.filter(change => change.surfaceId === surfaceId)
          markDirty(surfaceId, nodeChanges)
        })
        if (changeSet.project) {
          committedCache.forEach((compilation, surfaceId) => {
            if (!registryUsageMatchesSnapshot(compilation, snapshot))
              markDirty(surfaceId)
          })
        }
      }
      draftCache.clear()
    }
    currentSnapshot = snapshot
  }

  function compileSurface(surfaceId: SurfaceId): CompileCanonicalSurfaceResult {
    const contextFailure = invalidContextResult()
    if (contextFailure)
      return contextFailure
    if (!currentSnapshot) {
      return {
        success: false,
        diagnostics: [{
          code: 'COMPILER_COORDINATOR_SNAPSHOT_REQUIRED',
          message: 'CompileCoordinator requires an accepted committed snapshot.',
          surfaceId,
        }],
      }
    }

    const cached = committedCache.get(surfaceId)
    if (cached && !dirtySurfaces.has(surfaceId)) {
      const rebound = rebindSurfaceCompilation(cached, currentSnapshot, surfaceId)
      touchCache(committedCache, surfaceId, rebound)
      return { success: true, compilation: rebound, diagnostics: [] }
    }

    const result = cached && pendingNodeChanges.has(surfaceId)
      ? compileIncrementalPreparedSurface(
          currentSnapshot,
          surfaceId,
          context!,
          cached,
          pendingNodeChanges.get(surfaceId)!,
        )
      : compilePreparedSurface(currentSnapshot, surfaceId, context!)
    if (!result.success)
      return result
    const compilation = cached && sameSurfaceCompilationKey(cached, result.compilation)
      ? rebindSurfaceCompilation(cached, currentSnapshot, surfaceId)
      : result.compilation
    dirtySurfaces.delete(surfaceId)
    pendingNodeChanges.delete(surfaceId)
    touchCache(committedCache, surfaceId, compilation)
    return { success: true, compilation, diagnostics: [] }
  }

  function compileDraftSurface(
    snapshot: ProjectDraftSnapshot,
    surfaceId: SurfaceId,
    changeSet?: ProjectChangeSet,
  ): CompileCanonicalSurfaceResult {
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
          surfaceId,
        }],
      }
    }

    const cacheKey = `${snapshot.base.projectId}:${snapshot.base.editVersion}:${surfaceId}:${snapshot.draftHash}`
    const cached = draftCache.get(cacheKey)
    if (cached) {
      touchCache(draftCache, cacheKey, cached)
      return { success: true, compilation: cached, diagnostics: [] }
    }

    const committed = committedCache.get(surfaceId)
    const affected = changeSet
      ? affectedSurfaceIds(currentSnapshot.document, snapshot.document, changeSet)
      : undefined
    const result = committed && affected && !affected.has(surfaceId)
      ? {
          success: true as const,
          compilation: rebindSurfaceCompilation(committed, snapshot, surfaceId),
          diagnostics: [] as [],
        }
      : committed && affected?.has(surfaceId)
        ? compileIncrementalPreparedSurface(
            snapshot,
            surfaceId,
            context!,
            committed,
            changeSet!.nodeChanges,
          )
        : compilePreparedSurface(snapshot, surfaceId, context!)
    if (!result.success)
      return result
    const semanticMatch = [...draftCache.values()].find(candidate => (
      sameSurfaceCompilationKey(candidate, result.compilation)
    ))
    const compilation = semanticMatch
      ? rebindSurfaceCompilation(semanticMatch, snapshot, surfaceId)
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
      dirtySurfaces.clear()
      pendingNodeChanges.clear()
    },
    compileDraftSurface,
    compileSurface,
  }
}

function hasChanges(changeSet: ProjectChangeSet): boolean {
  return changeSet.project
    || changeSet.surfaceIds.length > 0
    || changeSet.datasetIds.length > 0
    || changeSet.resourceIds.length > 0
    || changeSet.nodeChanges.length > 0
}

function affectedSurfaceIds(
  before: ReadonlyProjectDocument,
  after: ReadonlyProjectDocument,
  changeSet: ProjectChangeSet,
): Set<SurfaceId> {
  const affected = new Set<SurfaceId>(changeSet.surfaceIds)
  changeSet.nodeChanges.forEach(change => affected.add(change.surfaceId))
  const datasetIds = new Set(changeSet.datasetIds)
  const resourceIds = new Set(changeSet.resourceIds)
  if (datasetIds.size === 0 && resourceIds.size === 0)
    return affected

  const visit = (document: ReadonlyProjectDocument): void => {
    document.surfaceOrder.forEach((surfaceId) => {
      const surface = document.surfacesById[surfaceId]
      if (!surface)
        return
      const referencesChangedEntity = Object.values(surface.graph.nodesById).some(node => (
        Object.values(node.datasetBindings ?? {}).some(binding => datasetIds.has(binding.datasetId))
        || Object.values(node.resourceBindings ?? {}).some(binding => resourceIds.has(binding.resourceId))
      ))
      if (referencesChangedEntity)
        affected.add(surfaceId)
    })
  }
  visit(before)
  visit(after)
  return affected
}

function sameSurfaceCompilationKey(left: SurfaceCompilation, right: SurfaceCompilation): boolean {
  const leftKey = left.key
  const rightKey = right.key
  return leftKey.irVersion === rightKey.irVersion
    && leftKey.projectId === rightKey.projectId
    && leftKey.surfaceId === rightKey.surfaceId
    && leftKey.registryAdapter === rightKey.registryAdapter
    && leftKey.registryAdapterVersion === rightKey.registryAdapterVersion
    && leftKey.registryUsageHash === rightKey.registryUsageHash
    && leftKey.compilerVersion === rightKey.compilerVersion
    && leftKey.environmentHash === rightKey.environmentHash
    && leftKey.semanticHash === rightKey.semanticHash
}

function rebindSurfaceCompilation(
  compilation: SurfaceCompilation,
  snapshot: ProjectSnapshot | ProjectDraftSnapshot,
  surfaceId: SurfaceId,
): SurfaceCompilation {
  const snapshotIdentity = surfaceSnapshotIdentity(snapshot, surfaceId)
  if (sameSurfaceSnapshotIdentity(compilation.snapshotIdentity, snapshotIdentity))
    return compilation
  return deepFreeze({
    snapshotIdentity,
    registryUsage: compilation.registryUsage,
    key: compilation.key,
    surface: compilation.surface,
    theme: clone(snapshot.document.theme),
    datasetsById: compilation.datasetsById,
  })
}

function sameSurfaceSnapshotIdentity(
  left: SurfaceCompilationSnapshotIdentity,
  right: SurfaceCompilationSnapshotIdentity,
): boolean {
  if (left.source !== right.source)
    return false
  if (left.projectId !== right.projectId
    || left.surfaceId !== right.surfaceId
    || left.contentHash !== right.contentHash) {
    return false
  }
  return left.source === 'committed' && right.source === 'committed'
    ? left.editVersion === right.editVersion
    : left.source === 'draft' && right.source === 'draft'
      && left.baseEditVersion === right.baseEditVersion
      && left.draftId === right.draftId
}
