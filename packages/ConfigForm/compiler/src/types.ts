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
  ProjectChangeSet,
  ProjectCompilationSnapshot,
  ProjectDraftSnapshot,
  ProjectResourceReference,
  ProjectSnapshot,
  RegisteredBinding,
  RegisteredEventAction,
  RegistryContractSnapshot,
  SlotName,
  ValidateTrigger,
} from '@moluoxixi/config-form-model'

export const CANONICAL_PROJECT_IR_VERSION = 3 as const
export const CONFIG_FORM_COMPILER_VERSION = '2.2.0' as const

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

export interface CanonicalPageRegistryUsage {
  key: ComponentKey
  contractVersion: string
  fingerprint: string
}

export interface CanonicalPageIdentity {
  irVersion: typeof CANONICAL_PROJECT_IR_VERSION
  projectId: string
  pageId: PageId
  registryAdapter: string
  registryAdapterVersion: string
  registryUsageHash: string
  compilerVersion: string
  environmentHash: string
  semanticHash: string
}

export interface CanonicalNodePlacement {
  parentId: NodeId | null
  slot: SlotName | null
  props: ModelJsonObject
}

interface CanonicalNodeBase {
  id: NodeId
  component: ComponentKey
  componentVersion: string
  componentFingerprint: string
  /** Hash of this node and its complete semantic subtree. */
  subtreeHash: string
  placement: CanonicalNodePlacement
  configuredProps: ModelJsonObject
  props: ModelJsonObject
  events: Record<string, RegisteredEventAction[]>
  bindings: Record<string, RegisteredBinding>
  flowEvents?: string[]
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

export type PageCompilationSnapshotIdentity
  = | {
    source: 'committed'
    projectId: string
    pageId: PageId
    contentHash: string
    editVersion: number
  }
  | {
    source: 'draft'
    projectId: string
    pageId: PageId
    contentHash: string
    baseEditVersion: number
    draftId: string
  }

export interface PageCompilationDocument {
  snapshotIdentity: PageCompilationSnapshotIdentity
  registryUsage: CanonicalPageRegistryUsage[]
  key: CanonicalPageIdentity
  page: CanonicalPageIR
}

/**
 * Indivisible page-scoped compiler output for Design and Preview. The full
 * ProjectDocument stays outside the realtime Runtime boundary.
 */
export type PageCompilation = DeepReadonly<PageCompilationDocument>

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

export interface CompileCanonicalPageInput extends CompileCanonicalProjectInput {
  pageId: PageId
}

export interface CreateCompileCoordinatorOptions {
  registry: RegistryContractSnapshot | unknown
  environment?: Partial<SemanticCompilerEnvironment>
  maxCachedPages?: number
}

export interface CompileCoordinator {
  acceptSnapshot: (snapshot: ProjectSnapshot, changeSet?: ProjectChangeSet) => void
  compilePage: (pageId: PageId) => CompileCanonicalPageResult
  compileDraftPage: (
    snapshot: ProjectDraftSnapshot,
    pageId: PageId,
    changeSet?: ProjectChangeSet,
  ) => CompileCanonicalPageResult
  clear: () => void
}

export type CompileCanonicalProjectResult
  = | { success: true, compilation: ProjectCompilation, diagnostics: [] }
    | { success: false, diagnostics: SemanticCompilerDiagnostic[] }

export type CompileCanonicalPageResult
  = | { success: true, compilation: PageCompilation, diagnostics: [] }
    | { success: false, diagnostics: SemanticCompilerDiagnostic[] }
