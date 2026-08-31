import type {
  CompileCoordinator,
  PageCompilation,
} from '@moluoxixi/config-form-compiler'
import type {
  DesignCommandPreview,
} from '@moluoxixi/config-form-designer'
import type {
  PageGraph,
  ProjectChangeSet,
  ProjectCommand,
  ProjectCompilationSnapshot,
  ProjectDocument,
  ProjectHistorySummary,
} from '@moluoxixi/config-form-model'
import type {
  VueRuntimeCompileResult,
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchAdapter } from '../adapters'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
} from '../project'
import { createCompileCoordinator } from '@moluoxixi/config-form-compiler'
import {
  applyProjectDraftTransaction,
  createProjectDraftSnapshotFromTransaction,
  resolveProjectCommand,
} from '@moluoxixi/config-form-model'
import { compileCanonicalPageRuntime } from '@moluoxixi/config-form-vue-backend'
import { computed, ref, shallowRef } from 'vue'
import { projectSnapshotFromEditorSession } from '../project'
import { createPageRuntimeArtifactCache } from './page-runtime-cache'

export interface WorkbenchDesignSessionOptions {
  getAdapter: () => WorkbenchAdapter | undefined
  getPageId: () => string
  getProjectSession: () => ProjectEditorSession | undefined
  getSnapshot: () => ProjectEditorSessionSnapshot | undefined
  setDiagnostic: (message: string) => void
}

export interface WorkbenchDesignPublication {
  compilation?: PageCompilation
  runtime: VueRuntimeCompileResult
}

export interface WorkbenchDesignSession {
  readonly commandControl: {
    execute: (command: ProjectCommand) => { changed: boolean, diagnostics: ReturnType<ProjectEditorSession['execute']>['diagnostics'] }
    preview: (command: ProjectCommand) => DesignCommandPreview | undefined
  }
  readonly compilation: ShallowRef<PageCompilation | undefined>
  readonly historyControl: ComputedRef<{
    canUndo: boolean
    canRedo: boolean
    history: ProjectHistorySummary | undefined
    jump: (position: number) => boolean
    undo: () => boolean
    redo: () => boolean
  }>
  readonly runtime: ShallowRef<VueRuntimeCompileSuccess | undefined>
  readonly selectedIds: Ref<string[]>
  accept: (
    snapshot: ProjectEditorSessionSnapshot,
    pageId: string,
    changeSet?: ProjectChangeSet,
  ) => WorkbenchDesignPublication
  clear: () => void
  configure: (adapter: WorkbenchAdapter) => void
  dispose: () => void
  getCompilation: (command?: ProjectCommand) => PageCompilation | undefined
}

interface CandidateProjection {
  compilation: PageCompilation
  graph: PageGraph
}

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
  const compilation = shallowRef<PageCompilation>()
  const runtime = shallowRef<VueRuntimeCompileSuccess>()
  const selectedIds = ref<string[]>([])
  const artifactCache = createPageRuntimeArtifactCache()
  let coordinator: CompileCoordinator | undefined

  function configure(adapter: WorkbenchAdapter): void {
    coordinator?.clear()
    artifactCache.clear()
    coordinator = createCompileCoordinator({ registry: adapter.registrySnapshot })
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
  }

  function compile(
    snapshot: ProjectCompilationSnapshot,
    pageId: string,
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
      ? coordinator.compileDraftPage(snapshot, pageId, changeSet)
      : (() => {
          coordinator.acceptSnapshot(snapshot, changeSet)
          return coordinator.compilePage(pageId)
        })()
    if (!canonical.success)
      return { runtime: compilerDiagnostics(canonical.diagnostics) }

    const nextCompilation = canonical.compilation
    return {
      compilation: nextCompilation,
      runtime: artifactCache.resolve(
        nextCompilation,
        () => compileCanonicalPageRuntime({ compilation: nextCompilation }, adapter.runtimeResolver),
      ),
    }
  }

  function accept(
    snapshot: ProjectEditorSessionSnapshot,
    pageId: string,
    changeSet?: ProjectChangeSet,
  ): WorkbenchDesignPublication {
    const publication = compile(projectSnapshotFromEditorSession(snapshot), pageId, changeSet)
    compilation.value = publication.compilation
    runtime.value = publication.runtime.success ? publication.runtime : undefined
    options.setDiagnostic(publication.runtime.success
      ? ''
      : publication.runtime.diagnostics[0]?.message ?? 'Workbench design compilation failed.')
    return publication
  }

  function candidate(command: ProjectCommand): CandidateProjection | undefined {
    const snapshot = options.getSnapshot()
    const adapter = options.getAdapter()
    const pageId = options.getPageId()
    if (!snapshot || !adapter || !pageId)
      return undefined

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
        pageId,
        {
          project: draft.changedProject,
          pageIds: draft.changedPageIds,
          nodeIds: draft.changedNodeIds,
          nodeChanges: draft.changedNodeChanges,
        },
      )
      const graph = draft.document.pagesById[pageId]?.graph
      return publication.compilation && graph
        ? { compilation: publication.compilation, graph }
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
    options.setDiagnostic(result.diagnostics[0]?.message ?? '')
    return { changed: result.changed, diagnostics: result.diagnostics }
  }

  function preview(command: ProjectCommand): DesignCommandPreview | undefined {
    const projection = candidate(command)
    const adapter = options.getAdapter()
    if (!projection || !adapter)
      return undefined
    const result = compileCanonicalPageRuntime(
      { compilation: projection.compilation },
      adapter.runtimeResolver,
    )
    return {
      command,
      graph: projection.graph,
      ...(result.success ? { renderer: result.artifact.plan.renderer } : {}),
    }
  }

  function undo(): boolean {
    const result = options.getProjectSession()?.undo()
    options.setDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function redo(): boolean {
    const result = options.getProjectSession()?.redo()
    options.setDiagnostic(result?.diagnostics[0]?.message ?? '')
    return result?.changed ?? false
  }

  function jump(position: number): boolean {
    const session = options.getProjectSession()
    const snapshot = options.getSnapshot()
    if (!session || !snapshot || !Number.isSafeInteger(position)
      || position < 0 || position > snapshot.history.entries.length) {
      return false
    }
    let current = snapshot.history.position
    let changed = false
    while (current > position) {
      const result = session.undo()
      if (!result.changed) {
        options.setDiagnostic(result.diagnostics[0]?.message ?? '')
        return changed
      }
      changed = true
      current -= 1
    }
    while (current < position) {
      const result = session.redo()
      if (!result.changed) {
        options.setDiagnostic(result.diagnostics[0]?.message ?? '')
        return changed
      }
      changed = true
      current += 1
    }
    options.setDiagnostic('')
    return changed
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
    compilation.value = undefined
    runtime.value = undefined
    selectedIds.value = []
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
