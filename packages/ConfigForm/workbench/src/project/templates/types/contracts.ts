import type {
  ProjectSurface,
  RegistryContractSnapshot,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../../adapters'
import type { IsolatedProjectPreview, ProjectIdentityFactory } from '../../types'

export type ProjectTemplateAdapter = WorkbenchAdapterId
export type TemplateCreationTarget = 'surface' | 'project'
export type ProjectTemplateCategory = 'blank' | 'starter'
export type ProjectTemplateViewport = 'desktop' | 'mobile' | 'tablet'

export interface ProjectTemplateComponentRequirement {
  key: string
  contractVersion?: string
  fingerprint?: string
}

export interface ProjectTemplateManifest {
  id: string
  version: typeof import('../constants').PROJECT_TEMPLATE_VERSION
  displayName: string
  description: string
  adapter: ProjectTemplateAdapter
  category: ProjectTemplateCategory
  order: number
  tags: string[]
  registry: {
    adapter: ProjectTemplateAdapter
    components: ProjectTemplateComponentRequirement[]
  }
  preview: {
    preferredViewport: ProjectTemplateViewport
    surfaceId: string
  }
}

export interface ProjectTemplateSeed {
  manifest: ProjectTemplateManifest
  surface: ProjectSurface
}

/** Providers return data only. Catalog parsing owns the unknown -> typed boundary. */
export interface TemplateCatalogProvider {
  readonly id: string
  list: () => Promise<readonly unknown[]>
}

export interface ProjectTemplateCatalogEntry extends ProjectTemplateSeed {
  providerId: string
}

export type TemplateCatalogDiagnosticCode
  = | 'TEMPLATE_ADAPTER_INVALID'
    | 'TEMPLATE_CATEGORY_INVALID'
    | 'TEMPLATE_DUPLICATE'
    | 'TEMPLATE_IDENTITY_REFERENCE_UNSUPPORTED'
    | 'TEMPLATE_INVALID'
    | 'TEMPLATE_NOT_FOUND'
    | 'TEMPLATE_PROVIDER_DUPLICATE'
    | 'TEMPLATE_PROVIDER_FAILED'
    | 'TEMPLATE_PROVIDER_INVALID'
    | 'TEMPLATE_REGISTRY_ADAPTER_MISMATCH'
    | 'TEMPLATE_REGISTRY_COMPONENT_FINGERPRINT_MISMATCH'
    | 'TEMPLATE_REGISTRY_COMPONENT_MISSING'
    | 'TEMPLATE_REGISTRY_COMPONENT_VERSION_MISMATCH'
    | 'TEMPLATE_REGISTRY_FINGERPRINT_MISMATCH'
    | 'TEMPLATE_REGISTRY_VERSION_MISMATCH'
    | 'TEMPLATE_SEED_INVALID'
    | 'TEMPLATE_TARGET_KIND_INVALID'
    | 'TEMPLATE_UNSAFE_KEY'
    | 'TEMPLATE_VERSION_INVALID'

export interface TemplateCatalogDiagnostic {
  code: TemplateCatalogDiagnosticCode
  message: string
  path?: string
  providerId?: string
  templateId?: string
}

export interface TemplateCatalogLoadResult {
  diagnostics: TemplateCatalogDiagnostic[]
  templates: ProjectTemplateCatalogEntry[]
}

export interface TemplateEligibilityResult {
  eligible: boolean
  diagnostics: TemplateCatalogDiagnostic[]
}

export interface TemplateEligibilityInput {
  registry: RegistryContractSnapshot
  target: TemplateCreationTarget
  targetLock?: RegistryLock
}

export interface InstantiateTemplateSurfaceInput {
  id: string
  identityFactory?: ProjectIdentityFactory
  name: string
  route?: string
}

export interface InstantiateTemplateProjectInput {
  id?: string
  identityFactory?: ProjectIdentityFactory
  name: string
  registryLock: RegistryLock
}

export type PreparedTemplatePreview = IsolatedProjectPreview
