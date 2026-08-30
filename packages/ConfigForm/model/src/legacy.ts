import type { ConfigFormFlow, ConfigFormReaction } from '@moluoxixi/config-form-core'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import type {
  ConditionExpression,
  ConditionTarget,
  FormSettings,
  ModelJsonObject,
  ModelJsonValue,
  PageGraph,
  RegisteredBinding,
  RegisteredEventAction,
  RegistryLock,
  ValidateTrigger,
} from './types'

export const LEGACY_LOW_CODE_PAGE_MODEL_VERSION = 1 as const
export const LEGACY_WORKSPACE_APPLICATION_VERSION = 2 as const
export const LEGACY_DESIGNER_DOCUMENT_VERSION = 1 as const
export const LEGACY_PROJECT_DOCUMENT_VERSION = 3 as const

export interface LegacyLowCodeNodeV1 {
  id: string
  component: string
  props: ModelJsonObject
  events: Record<string, RegisteredEventAction[]>
  bindings: Record<string, RegisteredBinding>
  children: LegacyLowCodeNodeV1[]
  slots: Record<string, LegacyLowCodeNodeV1[]>
  kind: 'field' | 'container'
  field?: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
  extensions?: ModelJsonObject
  span?: number
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

export interface LegacyLowCodePageModelV1 {
  id: string
  name: string
  version: typeof LEGACY_LOW_CODE_PAGE_MODEL_VERSION
  props: ModelJsonObject
  form: FormSettings
  nodes: LegacyLowCodeNodeV1[]
  flows?: ConfigFormFlow[]
}

interface LegacyDesignerNodeBaseV1 {
  id: string
  material: string
  props?: ModelJsonObject
  events?: Record<string, RegisteredEventAction[]>
  bindings?: Record<string, RegisteredBinding>
  extensions?: ModelJsonObject
  span?: number
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

export interface LegacyDesignerFieldNodeV1 extends LegacyDesignerNodeBaseV1 {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface LegacyDesignerLayoutNodeV1 extends LegacyDesignerNodeBaseV1 {
  kind: 'container'
  slots: Record<string, LegacyDesignerNodeV1[]>
}

export type LegacyDesignerNodeV1 = LegacyDesignerFieldNodeV1 | LegacyDesignerLayoutNodeV1

export interface LegacyDesignerDocumentV1 {
  version: typeof LEGACY_DESIGNER_DOCUMENT_VERSION
  form: FormSettings
  nodes: LegacyDesignerNodeV1[]
}

export interface LegacyWorkspacePageV2 {
  id: string
  model: LegacyLowCodePageModelV1
  name: string
  route: string
}

export interface LegacyWorkspaceApplicationV2 {
  schemaVersion: typeof LEGACY_WORKSPACE_APPLICATION_VERSION
  id: string
  name: string
  revision: number
  createdAt: string
  updatedAt: string
  homePageId: string
  pages: LegacyWorkspacePageV2[]
  files: Record<string, unknown>
  manifest: {
    adapter: string
    dependencies: Record<string, string>
    framework: string
    designerArtifact: string
    entry: string
    generatedFormModule: string
  }
  template: {
    id: string
    version: number
  }
}

export interface LegacyWorkspaceMigrationOptions {
  registryLock: RegistryLock
}

export interface LegacyProjectPageV3 {
  id: string
  name: string
  route: string
  graph: PageGraph & { flows?: ConfigFormFlow[] }
}

export interface LegacyProjectDocumentV3 {
  schemaVersion: typeof LEGACY_PROJECT_DOCUMENT_VERSION
  id: string
  name: string
  homePageId: string
  pageOrder: string[]
  pagesById: Record<string, LegacyProjectPageV3>
  registryLock: RegistryLock
  settings: ModelJsonObject
  resources: Record<string, unknown>
}
