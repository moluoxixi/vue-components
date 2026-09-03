import type { ProjectChangeSet, ProjectDraftSnapshot, ProjectNodeChange, ProjectSnapshot } from '@moluoxixi/config-form-model'
import type {
  CompileCanonicalPageResult,
  CompileCoordinator,
  CreateCompileCoordinatorOptions,
  PageCompilation,
  PageCompilationSnapshotIdentity,
} from '../../../types'
import { deepFreeze } from '../../../utils'
import { prepareCompilerContext } from './context'
import { compileIncrementalPreparedPage, compilePreparedPage, pageSnapshotIdentity } from './page'

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
