import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectDocument, ProjectPage } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../adapters'
import type { IsolatedProjectPreview } from '../isolated-preview'

export type ConfigImportTarget = 'page' | 'project'

export type ConfigImportDiagnosticCode
  = | 'IMPORT_ADAPTER_UNSUPPORTED'
    | 'IMPORT_ARRAY_LIMIT_EXCEEDED'
    | 'IMPORT_COMPONENT_MIGRATION_FAILED'
    | 'IMPORT_DEPTH_LIMIT_EXCEEDED'
    | 'IMPORT_FLOW_OWNERSHIP_AMBIGUOUS'
    | 'IMPORT_FILE_READ_FAILED'
    | 'IMPORT_FORMAT_UNSUPPORTED'
    | 'IMPORT_JSON_INVALID'
    | 'IMPORT_NODE_LIMIT_EXCEEDED'
    | 'IMPORT_PAGE_LIMIT_EXCEEDED'
    | 'IMPORT_PROJECT_INVALID'
    | 'IMPORT_REGISTRY_INCOMPATIBLE'
    | 'IMPORT_SOURCE_TOO_LARGE'
    | 'IMPORT_STRUCTURE_LIMIT_EXCEEDED'
    | 'IMPORT_STALE'
    | 'IMPORT_TARGET_MISMATCH'
    | 'IMPORT_UNSAFE_KEY'
    | 'IMPORT_VALUE_UNSAFE'
    | 'IMPORT_VERSION_UNSUPPORTED'
    | 'IMPORT_PAGE_INVALID'
    | 'IMPORT_PREVIEW_COMPILE_FAILED'

export interface ConfigImportDiagnostic {
  code: ConfigImportDiagnosticCode
  message: string
  path: string
}

export interface ConfigImportMigrationRecord {
  code: 'IMPORT_COMPONENT_MIGRATED' | 'IMPORT_PAGE_V1_TO_V2' | 'IMPORT_PROJECT_V3_TO_V4'
  fromVersion: string
  message: string
  path: string
  toVersion: string
}

export interface ConfigImportSummary {
  adapter: WorkbenchAdapterId
  flowCount: number
  name: string
  nodeCount: number
  pageCount: number
  pageGraphVersion: number
  resourceCount: number
  schemaVersion?: number
  target: ConfigImportTarget
}

interface PreparedConfigImportBase {
  adapter: WorkbenchAdapterId
  diagnostics: ConfigImportDiagnostic[]
  migrations: ConfigImportMigrationRecord[]
  preview: IsolatedProjectPreview
  previewCompilation: PageCompilation
  summary: ConfigImportSummary
  target: ConfigImportTarget
}

export interface PreparedProjectImport extends PreparedConfigImportBase {
  document: ProjectDocument
  target: 'project'
}

export interface PreparedPageImport extends PreparedConfigImportBase {
  originContentHash: string
  originProjectId: string
  page: ProjectPage
  target: 'page'
}

export type PreparedConfigImport = PreparedPageImport | PreparedProjectImport

export type PrepareConfigImportResult
  = | { success: true, prepared: PreparedConfigImport }
    | { success: false, diagnostics: ConfigImportDiagnostic[] }
