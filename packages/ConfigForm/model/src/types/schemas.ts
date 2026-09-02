import type {
  ModelDiagnostic,
  ProjectCompilationSnapshot,
  ProjectDocument,
  ProjectDraftSnapshot,
  ProjectSnapshot,
} from './contracts'

export type ProjectDocumentParseResult
  = | { success: true, data: ProjectDocument, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectSnapshotParseResult
  = | { success: true, data: ProjectSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectDraftSnapshotParseResult
  = | { success: true, data: ProjectDraftSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectCompilationSnapshotParseResult
  = | { success: true, data: ProjectCompilationSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }
