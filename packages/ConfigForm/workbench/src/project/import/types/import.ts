import type { SurfaceCompilation } from '@moluoxixi/config-form-compiler'
import type {
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectSurface,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type { WorkbenchAdapter, WorkbenchAdapterId } from '../../../adapters'
import type { IsolatedProjectPreview, ProjectIdentityFactory } from '../../types'

export type ConfigImportTarget = 'surface' | 'project'

export interface ImportedIdentityMaps {
  surfaces: ReadonlyMap<string, string>
  datasets: ReadonlyMap<string, string>
  resources: ReadonlyMap<string, string>
}

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
    | 'IMPORT_SURFACE_LIMIT_EXCEEDED'
    | 'IMPORT_PROJECT_INVALID'
    | 'IMPORT_REGISTRY_INVALID'
    | 'IMPORT_SOURCE_TOO_LARGE'
    | 'IMPORT_STRUCTURE_LIMIT_EXCEEDED'
    | 'IMPORT_STALE'
    | 'IMPORT_TARGET_MISMATCH'
    | 'IMPORT_UNSAFE_KEY'
    | 'IMPORT_VALUE_UNSAFE'
    | 'IMPORT_VERSION_UNSUPPORTED'
    | 'IMPORT_SURFACE_INVALID'
    | 'IMPORT_PREVIEW_COMPILE_FAILED'

export interface ConfigImportDiagnostic {
  code: ConfigImportDiagnosticCode
  message: string
  path: string
}

export interface ConfigImportSummary {
  adapter: WorkbenchAdapterId
  name: string
  nodeCount: number
  surfaceCount: number
  surfaceGraphVersion: number
  resourceCount: number
  version?: number
  target: ConfigImportTarget
}

interface PreparedConfigImportBase {
  adapter: WorkbenchAdapterId
  diagnostics: ConfigImportDiagnostic[]
  embeddedContents: ProjectEmbeddedResourceWrite[]
  preview: IsolatedProjectPreview
  previewCompilation: SurfaceCompilation
  summary: ConfigImportSummary
  target: ConfigImportTarget
}

export interface PreparedProjectImport extends PreparedConfigImportBase {
  document: ProjectDocument
  target: 'project'
}

export interface PreparedSurfaceImport extends PreparedConfigImportBase {
  originContentHash: string
  originProjectId: string
  /** Candidate document containing the flat dependency closure to add. */
  document: ProjectDocument
  surface: ProjectSurface
  registryLock: RegistryLock
  target: 'surface'
}

export type PreparedConfigImport = PreparedSurfaceImport | PreparedProjectImport

export type PrepareConfigImportResult
  = | { success: true, prepared: PreparedConfigImport }
    | { success: false, diagnostics: ConfigImportDiagnostic[] }

export type CanonicalImportPayload
  = | { target: 'surface', envelope: unknown }
    | { target: 'project', envelope: unknown }

export interface PreparedImportAdapterContext {
  adapter: WorkbenchAdapter
  identityFactory: ProjectIdentityFactory
}
