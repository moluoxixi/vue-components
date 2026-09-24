import type {
  CompileCoordinator,
  SurfaceCompilation,
} from '@moluoxixi/config-form-compiler'
import type { DesignCommandPreview } from '@moluoxixi/config-form-designer'
import type {
  ProjectChangeSet,
  ProjectCommand,
  ProjectCompilationSnapshot,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import type {
  VueRuntimeCompileResult,
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'
import type { WorkbenchAdapter } from '../../adapters'
import type { ProjectEditorSessionSnapshot } from '../../project'
import type { CandidateProjection, WorkbenchDesignPublication, WorkbenchDesignSession, WorkbenchDesignSessionOptions } from '../types'
import { createCompileCoordinator } from '@moluoxixi/config-form-compiler'
import {
  applyProjectDraftTransaction,
  createProjectDraftSnapshotFromTransaction,
  resolveProjectCommand,
} from '@moluoxixi/config-form-model'
import { compileCanonicalSurfaceRuntime } from '@moluoxixi/config-form-vue-backend'
import { computed, ref, shallowRef } from 'vue'
import { projectSnapshotFromEditorSession } from '../../project'
import { createSurfaceRuntimeArtifactCache } from './surface-runtime-cache'

const CANDIDATE_CACHE_LIMIT = 128

function compilerDiagnostics(
  diagnostics: ReadonlyArray<{
    code: string
    message: string
    path?: Array<string | number>
    nodeId?: string
  }>,
): VueRuntimeCompileResult {
  return {
    success: false,
    diagnostics: diagnostics.map(diagnostic => ({
      code: diagnostic.code,
      message: diagnostic.message,
      path: diagnostic.path ?? [],
      severity: 'error' as const,
      ...(diagnostic.nodeId ? { nodeId: diagnostic.nodeId } : {}),
    })),
  }
}

export function createWorkbenchDesignSession(
  options: WorkbenchDesignSessionOptions,
): WorkbenchDesignSession {
  const compilation = shallowRef<SurfaceCompilation>()
  const runtime = shallowRef<VueRuntimeCompileSuccess>()
  const selectedIds = ref<string[]>([])
  const artifactCache = createSurfaceRuntimeArtifactCache()
  // Drop-target validation previews the same candidate commands many times per
  // drag frame; memoize projections per document revision so repeated commands
  // skip the resolve/apply/compile pipeline entirely.
  const candidateCache = new Map<string, CandidateProjection | null>()
  let coordinator: CompileCoordinator | undefined
  let commandDiagnostic = ''
  let compileDiagnostic = ''

  function publishDiagnostic(): void {
    options.setDiagnostic(commandDiagnostic || compileDiagnostic)
  }

  function setCommandDiagnostic(message: string): void {
    commandDiagnostic = message
    publishDiagnostic()
  }

  function setCompileDiagnostic(message: string): void {
    compileDiagnostic = message
    publishDiagnostic()
  }

  function candidateCacheKey(command: ProjectCommand): string | undefined {
    const snapshot = options.getSnapshot()
    if (!snapshot)
      return undefined
    try {
      return `${snapshot.editVersion}:${options.getSurfaceId()}:${JSON.stringify(command)}`
    }
    catch {
      return undefined
    }
  }

  function configure(adapter: WorkbenchAdapter): void {
    coordinator?.clear()
    artifactCache.clear()
    candidateCache.clear()
    coordinator = createCompileCoordinator({ registry: adapter.registrySnapshot })
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
    commandDiagnostic = ''
    compileDiagnostic = ''
    publishDiagnostic()
  }

  function compile(
    snapshot: ProjectCompilationSnapshot,
    surfaceId: string,
    changeSet?: ProjectChangeSet,
  ): WorkbenchDesignPublication {
    const adapter = options.getAdapter()
    if (!adapter || !coordinator) {
      return { runtime: compilerDiagnostics([{
        code: 'RUNTIME_ADAPTER_UNAVAILABLE',
        message: 'Workbench runtime adapter is unavailable.',
        path: ['registryLock', 'adapter'],
      }]) }
    }

    const canonical = 'kind' in snapshot
      ? coordinator.compileDraftSurface(snapshot, surfaceId, changeSet)
      : (() => {
          coordinator.acceptSnapshot(snapshot, changeSet)
          return coordinator.compileSurface(surfaceId)
        })()
    if (!canonical.success)
      return { runtime: compilerDiagnostics(canonical.diagnostics) }

    const nextCompilation = canonical.compilation
    return {
      compilation: nextCompilation,
      runtime: artifactCache.resolve(
        nextCompilation,
        () => compileCanonicalSurfaceRuntime({ compilation: nextCompilation }, adapter.runtimeResolver),
      ),
    }
  }

  function accept(
    snapshot: ProjectEditorSessionSnapshot,
    surfaceId: string,
    changeSet?: ProjectChangeSet,
  ): WorkbenchDesignPublication {
    const publication = compile(projectSnapshotFromEditorSession(snapshot), surfaceId, changeSet)
    if (publication.compilation)
      compilation.value = publication.compilation
    if (publication.runtime.success)
      runtime.value = publication.runtime
    setCompileDiagnostic(publication.runtime.success
      ? ''
      : publication.runtime.diagnostics[0]?.message ?? 'Workbench design compilation failed.')
    return publication
  }

  function candidate(command: ProjectCommand): CandidateProjection | undefined {
    const snapshot = options.getSnapshot()
    const adapter = options.getAdapter()
    const surfaceId = options.getSurfaceId()
    if (!snapshot || !adapter || !surfaceId)
      return undefined

    const cacheKey = candidateCacheKey(command)
    if (cacheKey !== undefined) {
      const cached = candidateCache.get(cacheKey)
      if (cached !== undefined) {
        candidateCache.delete(cacheKey)
        candidateCache.set(cacheKey, cached)
        return cached ?? undefined
      }
    }

    const projection = computeCandidate(snapshot, adapter, surfaceId, command)
    if (cacheKey !== undefined) {
      candidateCache.set(cacheKey, projection ?? null)
      while (candidateCache.size > CANDIDATE_CACHE_LIMIT) {
        const oldest = candidateCache.keys().next().value
        if (oldest === undefined)
          break
        candidateCache.delete(oldest)
      }
    }
    return projection
  }

  function computeCandidate(
    snapshot: ProjectEditorSessionSnapshot,
    adapter: WorkbenchAdapter,
    surfaceId: string,
    command: ProjectCommand,
  ): CandidateProjection | undefined {
    try {
      const base = snapshot.document as ProjectDocument
      const resolution = resolveProjectCommand(base, command, { registry: adapter.componentRegistry })
      if (!resolution.success || resolution.transaction.operations.length === 0)
        return undefined
      const draft = applyProjectDraftTransaction(base, resolution.transaction, {
        registry: adapter.componentRegistry,
      })
      if (!draft.success || !draft.changed)
        return undefined
      const publication = compile(
        createProjectDraftSnapshotFromTransaction(
          projectSnapshotFromEditorSession(snapshot),
          draft,
          `design-candidate:${command.id}`,
        ),
        surfaceId,
        draft.changeSet,
      )
      const graph = draft.document.surfacesById[surfaceId]?.graph
      return publication.compilation && graph
        ? { compilation: publication.compilation, graph, runtime: publication.runtime }
        : undefined
    }
    catch {
      return undefined
    }
  }

  function execute(command: ProjectCommand) {
    const session = options.getProjectSession()
    if (!session)
      return { changed: false, diagnostics: [] }
    const result = session.execute(command)
    setCommandDiagnostic(result.diagnostics[0]?.message ?? '')
    return { changed: result.changed, diagnostics: result.diagnostics }
  }

  function preview(command: ProjectCommand): DesignCommandPreview | undefined {
    const projection = candidate(command)
    if (!projection || !projection.runtime.success)
      return undefined
    return {
      command,
      graph: projection.graph,
    }
  }

  function undo(): boolean {
    const result = options.getProjectSession()?.undo()
    setCommandDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function redo(): boolean {
    const result = options.getProjectSession()?.redo()
    setCommandDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function jump(position: number): boolean {
    const session = options.getProjectSession()
    const snapshot = options.getSnapshot()
    if (!session || !snapshot || !Number.isSafeInteger(position)
      || position < 0 || position > snapshot.history.entries.length) {
      return false
    }
    // Batch the undo/redo walk so subscribers (design/preview compilation,
    // autosave) receive one snapshot at the landing point instead of
    // recompiling once per traversed history entry.
    return session.batch(() => {
      let current = snapshot.history.position
      let changed = false
      while (current > position) {
        const result = session.undo()
        if (!result.changed) {
          setCommandDiagnostic(result.diagnostics[0]?.message ?? '')
          return changed
        }
        changed = true
        current -= 1
      }
      while (current < position) {
        const result = session.redo()
        if (!result.changed) {
          setCommandDiagnostic(result.diagnostics[0]?.message ?? '')
          return changed
        }
        changed = true
        current += 1
      }
      setCommandDiagnostic('')
      return changed
    })
  }

  const historyControl = computed(() => ({
    canUndo: options.getSnapshot()?.canUndo ?? false,
    canRedo: options.getSnapshot()?.canRedo ?? false,
    history: options.getSnapshot()?.history,
    jump,
    undo,
    redo,
  }))

  function clear(): void {
    coordinator?.clear()
    artifactCache.clear()
    candidateCache.clear()
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
    commandDiagnostic = ''
    compileDiagnostic = ''
    publishDiagnostic()
  }

  return {
    commandControl: { execute, preview },
    compilation,
    historyControl,
    runtime,
    selectedIds,
    accept,
    clear,
    configure,
    dispose: clear,
    getCompilation(command) {
      return command ? candidate(command)?.compilation : compilation.value
    },
  }
}
