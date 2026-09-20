import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ModelDiagnostic } from '@moluoxixi/config-form-model'
import type {
  ConfigBindingFileSetV1,
  RawSourceFileSetV1,
  SourceComponentResolver,
  SourceConfigFormBindingResolver,
  SourceResourceReader,
} from '@moluoxixi/config-form-source/generator'

export type ExportArtifact<T>
  = | { readonly status: 'ready', readonly fileSet: T }
    | { readonly status: 'failed', readonly diagnostics: readonly ModelDiagnostic[] }

export interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly configBindings: ExportArtifact<ConfigBindingFileSetV1>
  readonly rawSource: ExportArtifact<RawSourceFileSetV1>
}

export interface BuildExportSnapshotInput {
  compilation: ProjectCompilation
  bindingResolver: SourceConfigFormBindingResolver
  componentResolver: SourceComponentResolver
  resourceReader: SourceResourceReader
}

export interface ExportSessionState {
  readonly error?: string
  readonly snapshot?: ExportSnapshot
  readonly stale: boolean
}

export type ExportSessionRefreshResult
  = | { success: true, state: ExportSessionState, snapshot: ExportSnapshot }
    | { success: false, state: ExportSessionState, error: string }

export interface ExportSession {
  readonly state: ExportSessionState
  refresh: () => Promise<ExportSessionRefreshResult>
  subscribe: (listener: (state: ExportSessionState) => void) => () => void
  sync: () => ExportSessionState
}

export interface CreateExportSessionOptions {
  build?: (input: BuildExportSnapshotInput) => Promise<ExportSnapshot>
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation: () => ProjectCompilation | undefined
}
