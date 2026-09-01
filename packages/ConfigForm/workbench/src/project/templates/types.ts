import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ProjectDocument,
  ProjectPage,
  RegistryContractSnapshot,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type { WorkbenchAdapterId } from '../../adapters'
import type { RuntimeHostRuntimeStatePayload } from '../../runtime-host/protocol'
import type {
  ProjectIdentityFactory,
  ProjectIdentityKind,
  ProjectPageIdentityMap,
  RemappedProjectPage,
} from '../identity-remap'

export type ProjectTemplateAdapter = WorkbenchAdapterId
export type TemplateCreationTarget = 'page' | 'project'
export type ProjectTemplateCategory = 'blank' | 'starter'
export type ProjectTemplateViewport = 'desktop' | 'mobile' | 'tablet'

export interface ProjectTemplateComponentRequirement {
  key: string
  contractVersion?: string
  fingerprint?: string
}

export interface ProjectTemplateManifest {
  id: string
  version: number
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
    pageId: string
  }
}

export interface ProjectTemplateSeed {
  manifest: ProjectTemplateManifest
  page: ProjectPage
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

export interface TemplateCompatibilityResult {
  compatible: boolean
  diagnostics: TemplateCatalogDiagnostic[]
}

export interface TemplateCompatibilityInput {
  registry: RegistryContractSnapshot
  target: TemplateCreationTarget
  targetLock?: RegistryLock
}

export type TemplateIdentityKind = ProjectIdentityKind
export type TemplateIdentityFactory = ProjectIdentityFactory
export type TemplateIdentityMap = ProjectPageIdentityMap
export type RemappedTemplatePage = RemappedProjectPage

export interface InstantiateTemplatePageInput {
  id: string
  identityFactory?: TemplateIdentityFactory
  name: string
  route: string
}

export interface InstantiateTemplateProjectInput {
  id?: string
  identityFactory?: TemplateIdentityFactory
  name: string
  registryLock: RegistryLock
}

export interface PreparedTemplatePreview {
  adapter: ProjectTemplateAdapter
  compilation: PageCompilation
  namespace: string
  reactionProjection: ConfigFormReactionProjection<Record<string, unknown>>
  revision: string
  runtimeSessionKey: string
  runtimeState: RuntimeHostRuntimeStatePayload
}

export interface ProjectTemplateInput {
  id: string
  name: string
}

export interface ProjectPageTemplateInput extends ProjectTemplateInput {
  route: string
}

export interface ProjectTemplate {
  adapter: ProjectTemplateAdapter
  createPage: (input: ProjectPageTemplateInput) => ProjectPage
  createProject: (input: ProjectTemplateInput, registryLock: RegistryLock) => ProjectDocument
  description: string
  id: string
  order: number
  title: string
  version: number
}
