import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignCommandPreview } from '@moluoxixi/config-form-designer'
import type {
  PageGraph,
  ProjectChangeSet,
  ProjectCommand,
  ProjectHistorySummary,
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
    pageId: string,
    changeSet?: ProjectChangeSet,
  ) => WorkbenchDesignPublication
  clear: () => void
  configure: (adapter: WorkbenchAdapter) => void
  dispose: () => void
  getCompilation: (command?: ProjectCommand) => PageCompilation | undefined
}

export interface CandidateProjection {
  compilation: PageCompilation
  graph: PageGraph
}
