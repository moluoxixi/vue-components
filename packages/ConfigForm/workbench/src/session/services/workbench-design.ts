import type { CompileCoordinator, SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignCommandPreview } from '@moluoxixi/config-form-designer'
import type {
  ModelDiagnostic,
  ProjectChangeSet,
  ProjectCommand,
  ProjectCompilationSnapshot,
  ProjectDocument,
} from '@moluoxixi/config-form-model'
import type { VueRuntimeCompileResult, VueRuntimeCompileSuccess } from '@moluoxixi/config-form-vue-backend'
import type { WorkbenchAdapter } from '../../adapters'
import type { ProjectEditorSessionSnapshot } from '../../project'
import type {
  CandidateProjection,
  CandidateProjectionResult,
  WorkbenchDesignPublication,
  WorkbenchDesignSession,
  WorkbenchDesignSessionOptions,
} from '../types'
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

export function createWorkbenchDesignSession(options: WorkbenchDesignSessionOptions): WorkbenchDesignSession {
  const compilation = shallowRef<SurfaceCompilation>()
  const runtime = shallowRef<VueRuntimeCompileSuccess>()
  const candidateDiagnostic = shallowRef<ModelDiagnostic>()
  const selectedIds = ref<string[]>([])
  const diagnostics = shallowRef<readonly ModelDiagnostic[]>([])
  let compileDiagnostics: readonly ModelDiagnostic[] = []
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

  function setCandidateDiagnostic(diagnostic: ModelDiagnostic): void {
    const previous = candidateDiagnostic.value
    if (previous?.code === diagnostic.code && previous.message === diagnostic.message
      && previous.surfaceId === diagnostic.surfaceId
      && previous.context?.commandId === diagnostic.context?.commandId) {
      return
    }
    // Candidate compilation can run while rendering the host. Publishing a
    // new equal object on every failed retry would recursively render it.
    candidateDiagnostic.value = diagnostic
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
    candidateDiagnostic.value = undefined
    coordinator = createCompileCoordinator({ registry: adapter.registrySnapshot })
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
    commandDiagnostic = ''
    compileDiagnostic = ''
    compileDiagnostics = []
    diagnostics.value = []
    publishDiagnostic()
  }

  function compile(
    snapshot: ProjectCompilationSnapshot,
    surfaceId: string,
    changeSet?: ProjectChangeSet,
  ): WorkbenchDesignPublication {
    const adapter = options.getAdapter()
    if (!adapter || !coordinator) {
      return {
        runtime: compilerDiagnostics([
          {
            code: 'RUNTIME_ADAPTER_UNAVAILABLE',
            message: 'Workbench runtime adapter is unavailable.',
            path: ['registryLock', 'adapter'],
          },
        ]),
      }
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
      runtime: artifactCache.resolve(nextCompilation, () => compileCanonicalSurfaceRuntime({ compilation: nextCompilation }, adapter.runtimeResolver)),
    }
  }

  function accept(
    snapshot: ProjectEditorSessionSnapshot,
    surfaceId: string,
    changeSet?: ProjectChangeSet,
  ): WorkbenchDesignPublication {
    candidateCache.clear()
    candidateDiagnostic.value = undefined
    const publication = compile(projectSnapshotFromEditorSession(snapshot), surfaceId, changeSet)
    compileDiagnostics = publication.runtime.success
      ? []
      : publication.runtime.diagnostics.map(item => ({ ...item, surfaceId }))
    diagnostics.value = compileDiagnostics
    if (publication.compilation)
      compilation.value = publication.compilation
    if (publication.runtime.success)
      runtime.value = publication.runtime
    setCompileDiagnostic(
      publication.runtime.success
        ? ''
        : (publication.runtime.diagnostics[0]?.message ?? 'Workbench design compilation failed.'),
    )
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
        if (cached)
          candidateDiagnostic.value = undefined
        return cached ?? undefined
      }
    }

    const result = computeCandidate(snapshot, adapter, surfaceId, command)
    if (result.status === 'failed') {
      setCandidateDiagnostic(result.diagnostic)
      // A resolver/compiler may recover without a new document revision. Do
      // not turn a transient failure into a permanently memoized invalid drop.
      return undefined
    }
    const projection = result.status === 'accepted' ? result.projection : undefined
    if (projection)
      candidateDiagnostic.value = undefined
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
  ): CandidateProjectionResult {
    try {
      const base = snapshot.document as ProjectDocument
      const resolution = resolveProjectCommand(base, command, { registry: adapter.componentRegistry })
      if (!resolution.success || resolution.transaction.operations.length === 0)
        return { status: 'invalid' }
      const draft = applyProjectDraftTransaction(base, resolution.transaction, {
        registry: adapter.componentRegistry,
      })
      if (!draft.success || !draft.changed)
        return { status: 'invalid' }
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
      if (!publication.runtime.success) {
        return {
          status: 'failed',
          diagnostic: {
            code: 'WORKBENCH_CANDIDATE_COMPILE_FAILED',
            message: publication.runtime.diagnostics[0]?.message ?? 'Candidate compilation failed.',
            surfaceId,
            context: { commandId: command.id },
          },
        }
      }
      if (!publication.compilation || !graph)
        throw new Error('Candidate compilation did not produce its requested Surface.')
      return {
        status: 'accepted',
        projection: { compilation: publication.compilation, graph, runtime: publication.runtime },
      }
    }
    catch (error) {
      return {
        status: 'failed',
        diagnostic: {
          code: 'WORKBENCH_CANDIDATE_FAILED',
          message: error instanceof Error ? error.message : String(error),
          surfaceId,
          context: { commandId: command.id },
        },
      }
    }
  }

  function execute(command: ProjectCommand) {
    const session = options.getProjectSession()
    if (!session)
      return { changed: false, diagnostics: [] }
    const result = session.execute(command)
    diagnostics.value = [...compileDiagnostics, ...result.diagnostics]
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
    diagnostics.value = [...compileDiagnostics, ...(result?.diagnostics ?? [])]
    setCommandDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function redo(): boolean {
    const result = options.getProjectSession()?.redo()
    diagnostics.value = [...compileDiagnostics, ...(result?.diagnostics ?? [])]
    setCommandDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function jump(position: number): boolean {
    const session = options.getProjectSession()
    if (!session)
      return false
    const result = session.jump(position)
    diagnostics.value = [...compileDiagnostics, ...result.diagnostics]
    setCommandDiagnostic(result.diagnostics[0]?.message ?? '')
    return result.changed
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
    candidateDiagnostic.value = undefined
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
    commandDiagnostic = ''
    compileDiagnostic = ''
    diagnostics.value = []
    compileDiagnostics = []
    publishDiagnostic()
  }

  return {
    candidateDiagnostic,
    commandControl: { execute, preview },
    compilation,
    historyControl,
    runtime,
    selectedIds,
    diagnostics,
    accept,
    clear,
    configure,
    dispose: clear,
    getCompilation(command) {
      return command ? candidate(command)?.compilation : compilation.value
    },
  }
}
