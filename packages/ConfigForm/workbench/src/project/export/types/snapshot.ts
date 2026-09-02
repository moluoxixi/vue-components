import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectPath, WorkspaceFile } from '../../types'
import type { CanonicalSourceBindingResolver } from './bindings'

export interface ExportFileSet {
  readonly entry: ProjectPath
  readonly files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>
}

export interface ExportSnapshot {
  readonly compilation: ProjectCompilation
  readonly config: ExportFileSet
  readonly generatorVersion: string
  readonly source: ExportFileSet
}

export interface BuildExportSnapshotInput {
  compilation: ProjectCompilation
  resolver: CanonicalSourceBindingResolver
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
  build?: (input: BuildExportSnapshotInput) => ExportSnapshot
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation: () => ProjectCompilation | undefined
  currentGeneratorVersion?: () => string
}
