import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignCommandPreview } from '@moluoxixi/config-form-designer'
import type {
  ProjectChangeSet,
  ProjectCommand,
  ProjectHistorySummary,
  SurfaceGraph,
} from '@moluoxixi/config-form-model'
import type {
  VueRuntimeCompileResult,
  VueRuntimeCompileSuccess,
} from '@moluoxixi/config-form-vue-backend'
import type { ComputedRef, Ref, ShallowRef } from 'vue'
import type { WorkbenchAdapter } from '../../adapters'
import type {
  ProjectEditorSession,
  ProjectEditorSessionSnapshot,
} from '../../project'

export interface WorkbenchDesignSessionOptions {
  getAdapter: () => WorkbenchAdapter | undefined
  getSurfaceId: () => string
  getProjectSession: () => ProjectEditorSession | undefined
  getSnapshot: () => ProjectEditorSessionSnapshot | undefined
  setDiagnostic: (message: string) => void
}

export interface WorkbenchDesignPublication {
  compilation?: SurfaceCompilation
  runtime: VueRuntimeCompileResult
}

export interface WorkbenchDesignSession {
  readonly commandControl: {
    execute: (command: ProjectCommand) => { changed: boolean, diagnostics: ReturnType<ProjectEditorSession['execute']>['diagnostics'] }
    preview: (command: ProjectCommand) => DesignCommandPreview | undefined
  }
  readonly compilation: ShallowRef<SurfaceCompilation | undefined>
  readonly historyControl: ComputedRef<{
    canRedo: boolean
    canUndo: boolean
    history: ProjectHistorySummary | undefined
    jump: (position: number) => boolean
    redo: () => boolean
    undo: () => boolean
  }>
  readonly runtime: ShallowRef<VueRuntimeCompileSuccess | undefined>
  readonly selectedIds: Ref<string[]>
  accept: (
    snapshot: ProjectEditorSessionSnapshot,
    surfaceId: string,
    changeSet?: ProjectChangeSet,
  ) => WorkbenchDesignPublication
  clear: () => void
  configure: (adapter: WorkbenchAdapter) => void
  dispose: () => void
  getCompilation: (command?: ProjectCommand) => SurfaceCompilation | undefined
}

export interface CandidateProjection {
  compilation: SurfaceCompilation
  graph: SurfaceGraph
  runtime: VueRuntimeCompileResult
}
