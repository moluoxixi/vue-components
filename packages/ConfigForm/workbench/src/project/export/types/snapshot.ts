import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ConfigBindingFileSetV1,
  RawSourceFileSetV1,
  SourceProviderResolver,
  SourceResourceReader,
} from '@moluoxixi/config-form-source/generator'

export interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly configBindings: ConfigBindingFileSetV1
  readonly generatorVersion: string
  readonly rawSource: RawSourceFileSetV1
}

export interface BuildExportSnapshotInput {
  compilation: ProjectCompilation
  providerResolver: SourceProviderResolver
  resourceReader: SourceResourceReader
  generatorVersion?: string
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
  currentGeneratorVersion?: () => string
}
