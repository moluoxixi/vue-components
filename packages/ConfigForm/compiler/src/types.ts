import type { ConfigFormFlowExecutionPlan } from '@moluoxixi/config-form-core'
import type {
  ComponentKey,
  DeepReadonly,
  FieldNode,
  FormSettings,
  ModelJsonObject,
  ModelJsonValue,
  NodeId,
  PageId,
  PageNode,
  ProjectCompilationSnapshot,
  ProjectResourceReference,
  RegisteredBinding,
  RegisteredEventAction,
  RegistryContractSnapshot,
  SlotName,
  ValidateTrigger,
} from '@moluoxixi/config-form-model'

export const CANONICAL_PROJECT_IR_VERSION = 2 as const
export const CONFIG_FORM_COMPILER_VERSION = '2.0.0' as const

export interface SemanticCompilerEnvironment {
  version: string
  features: ModelJsonObject
}

export interface CanonicalProjectIdentity {
  projectId: string
  contentHash: string
  registryAdapter: string
  registryAdapterVersion: string
  registryFingerprint: string
  compilerVersion: string
  environmentHash: string
  irHash: string
}

export interface CanonicalNodePlacement {
  parentId: NodeId | null
  slot: SlotName | null
  index: number
  props: ModelJsonObject
}

interface CanonicalNodeBase {
  id: NodeId
  component: ComponentKey
  componentVersion: string
  componentFingerprint: string
  path: NodeId[]
  placement: CanonicalNodePlacement
  configuredProps: ModelJsonObject
  props: ModelJsonObject
  events: Record<string, RegisteredEventAction[]>
  bindings: Record<string, RegisteredBinding>
  extensions?: ModelJsonObject
  conditions?: PageNode['conditions']
  reactions?: PageNode['reactions']
}

export interface CanonicalFieldNodeIR extends CanonicalNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: FieldNode['validation']
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface CanonicalLayoutNodeIR extends CanonicalNodeBase {
  kind: 'layout'
  slots: Record<SlotName, NodeId[]>
}

export type CanonicalNodeIR = CanonicalFieldNodeIR | CanonicalLayoutNodeIR

export interface CanonicalFlowIR {
  semanticHash: string
  plan: ConfigFormFlowExecutionPlan
}

export interface CanonicalPageIR {
  id: PageId
  name: string
  route: string
  props: ModelJsonObject
  form: FormSettings
  rootIds: NodeId[]
  nodesById: Record<NodeId, CanonicalNodeIR>
  flows: CanonicalFlowIR[]
}

export interface CanonicalProjectIRDocument {
  version: typeof CANONICAL_PROJECT_IR_VERSION
  identity: CanonicalProjectIdentity
  name: string
  homePageId: PageId
  pageOrder: PageId[]
  pagesById: Record<PageId, CanonicalPageIR>
  settings: ModelJsonObject
  resources: Record<string, ProjectResourceReference>
  environment: SemanticCompilerEnvironment
}

export type CanonicalProjectIR = DeepReadonly<CanonicalProjectIRDocument>

export type ProjectCompilationOrigin
  = | {
    kind: 'committed'
    editVersion: number
  }
  | {
    kind: 'draft'
    baseEditVersion: number
    draftId: string
  }

export interface ProjectCompilationDocument {
  snapshot: ProjectCompilationSnapshot
  registry: RegistryContractSnapshot
  origin: ProjectCompilationOrigin
  key: CanonicalProjectIdentity
  ir: CanonicalProjectIR
}

/**
 * Indivisible compiler output. Consumers must retain this envelope instead of
 * pairing a project snapshot, Registry snapshot, and Canonical IR themselves.
 */
export type ProjectCompilation = DeepReadonly<ProjectCompilationDocument>

export interface SemanticCompilerDiagnostic {
  code: string
  message: string
  path?: Array<string | number>
  pageId?: PageId
  nodeId?: NodeId
}

export interface CompileCanonicalProjectInput {
  snapshot: unknown
  registry: RegistryContractSnapshot | unknown
  environment?: Partial<SemanticCompilerEnvironment>
}

export type CompileCanonicalProjectResult
  = | { success: true, compilation: ProjectCompilation, diagnostics: [] }
    | { success: false, diagnostics: SemanticCompilerDiagnostic[] }
