import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ProjectDocument, ProjectPage, RegistryLock } from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../../adapters'
import type { IsolatedProjectPreview, ProjectIdentityFactory } from '../../types'

export type ConfigImportTarget = 'page' | 'project'

export interface PrepareConfigImportOptions {
  currentProject?: ProjectDocument
  identityFactory?: ProjectIdentityFactory
  loadAdapter?: (id: WorkbenchAdapterId) => Promise<WorkbenchAdapter>
  source: string
  target: ConfigImportTarget
}

export type ConfigImportDiagnosticCode
  = | 'IMPORT_ADAPTER_UNSUPPORTED'
    | 'IMPORT_ARRAY_LIMIT_EXCEEDED'
    | 'IMPORT_DEPTH_LIMIT_EXCEEDED'
    | 'IMPORT_FILE_READ_FAILED'
    | 'IMPORT_FORMAT_UNSUPPORTED'
    | 'IMPORT_JSON_INVALID'
    | 'IMPORT_NODE_LIMIT_EXCEEDED'
    | 'IMPORT_PAGE_LIMIT_EXCEEDED'
    | 'IMPORT_PROJECT_INVALID'
    | 'IMPORT_REGISTRY_INVALID'
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

export interface ConfigImportSummary {
  adapter: WorkbenchAdapterId
  flowCount: number
  name: string
  nodeCount: number
  pageCount: number
  pageGraphVersion: number
  resourceCount: number
  version?: number
  target: ConfigImportTarget
}

interface PreparedConfigImportBase {
  adapter: WorkbenchAdapterId
  diagnostics: ConfigImportDiagnostic[]
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

export interface PageTransferDocument {
  kind: 'config-form-page'
  version: typeof import('../constants').PAGE_TRANSFER_VERSION
  registryLock: RegistryLock
  page: ProjectPage
}

export type CanonicalImportPayload
  = | { target: 'page', page: ProjectPage, registryLock: RegistryLock }
    | { target: 'project', document: ProjectDocument }
