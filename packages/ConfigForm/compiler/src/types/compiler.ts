import type {
  ComponentKey,
  DatasetId,
  DatasetReference,
  DeepReadonly,
  FieldNode,
  FormSettings,
  LayoutNode,
  ModelJsonObject,
  ModelJsonValue,
  NodeId,
  ProjectChangeSet,
  ProjectCompilationSnapshot,
  ProjectDataset,
  ProjectDialogSurface,
  ProjectDraftSnapshot,
  ProjectDrawerSurface,
  ProjectResource,
  ProjectSnapshot,
  ProjectTheme,
  PrototypeInteraction,
  RegistryContractSnapshot,
  ResourceId,
  SlotName,
  StaticResourceReference,
  SurfaceId,
  SurfaceOutputDefinition,
  SurfaceParameterDefinition,
  SurfaceValueSchema,
  ValidateTrigger,
} from '@moluoxixi/config-form-model'
import type { CANONICAL_PROJECT_IR_VERSION } from '../constants/versions'

export type MutableClone<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? [MutableClone<Head>, ...MutableClone<Tail>]
    : T extends readonly (infer Item)[]
      ? MutableClone<Item>[]
      : T extends object
        ? { -readonly [Key in keyof T]: MutableClone<T[Key]> }
        : T

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

export interface CanonicalSurfaceRegistryUsage {
  key: ComponentKey
  contractVersion: string
  fingerprint: string
}

export interface CanonicalSurfaceIdentity {
  irVersion: typeof CANONICAL_PROJECT_IR_VERSION
  projectId: string
  surfaceId: SurfaceId
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
  datasetBindings?: Record<string, DatasetReference>
  resourceBindings?: Record<string, StaticResourceReference>
  extensions?: ModelJsonObject
}

export interface CanonicalFieldDescriptor {
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: FieldNode['validation']
  validateOn: ValidateTrigger[]
}

export interface CanonicalFieldNodeIR extends CanonicalNodeBase, CanonicalFieldDescriptor {
  kind: 'field'
}

export interface CanonicalLayoutNodeIR extends CanonicalNodeBase {
  kind: 'layout'
  slots: Record<SlotName, NodeId[]>
  valueScope?: LayoutNode['valueScope']
}

export interface CanonicalElementNodeIR extends CanonicalNodeBase {
  kind: 'element'
}

export type CanonicalNodeIR = CanonicalFieldNodeIR | CanonicalLayoutNodeIR | CanonicalElementNodeIR

interface CanonicalSurfaceBaseIR extends SurfaceValueSchema {
  id: SurfaceId
  name: string
  kind: 'page' | 'dialog' | 'drawer'
  props: ModelJsonObject
  form: FormSettings
  rootIds: NodeId[]
  nodesById: Record<NodeId, CanonicalNodeIR>
  parameters: SurfaceParameterDefinition[]
  outputs: SurfaceOutputDefinition[]
  interactions: PrototypeInteraction[]
}

export interface CanonicalRouteSurfaceIR extends CanonicalSurfaceBaseIR {
  kind: 'page'
  route: string
}

export interface CanonicalDialogSurfaceIR extends CanonicalSurfaceBaseIR {
  kind: 'dialog'
  presentation: ProjectDialogSurface['presentation']
}

export interface CanonicalDrawerSurfaceIR extends CanonicalSurfaceBaseIR {
  kind: 'drawer'
  presentation: ProjectDrawerSurface['presentation']
}

export type CanonicalSurfaceIR = CanonicalRouteSurfaceIR | CanonicalDialogSurfaceIR | CanonicalDrawerSurfaceIR

export interface CanonicalProjectIRDocument {
  version: typeof CANONICAL_PROJECT_IR_VERSION
  identity: CanonicalProjectIdentity
  name: string
  homeSurfaceId: SurfaceId
  surfaceOrder: SurfaceId[]
  surfacesById: Record<SurfaceId, CanonicalSurfaceIR>
  datasetOrder: DatasetId[]
  datasetsById: Record<DatasetId, ProjectDataset>
  resources: Record<ResourceId, ProjectResource>
  theme: ProjectTheme
  settings: ModelJsonObject
  environment: SemanticCompilerEnvironment
}

export type CanonicalProjectIR = DeepReadonly<CanonicalProjectIRDocument>

export type SurfaceCompilationSnapshotIdentity
  = | {
    source: 'committed'
    projectId: string
    surfaceId: SurfaceId
    contentHash: string
    editVersion: number
  }
  | {
    source: 'draft'
    projectId: string
    surfaceId: SurfaceId
    contentHash: string
    baseEditVersion: number
    draftId: string
  }

export interface SurfaceCompilationDocument {
  snapshotIdentity: SurfaceCompilationSnapshotIdentity
  registryUsage: CanonicalSurfaceRegistryUsage[]
  key: CanonicalSurfaceIdentity
  surface: CanonicalSurfaceIR
}

/** Indivisible Surface-scoped compiler output for Design hosts. */
export type SurfaceCompilation = DeepReadonly<SurfaceCompilationDocument>

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
  surfaceId?: SurfaceId
  nodeId?: NodeId
}

export interface CompileCanonicalProjectInput {
  snapshot: unknown
  registry: RegistryContractSnapshot | unknown
  environment?: Partial<SemanticCompilerEnvironment>
}

export interface CompileCanonicalSurfaceInput extends CompileCanonicalProjectInput {
  surfaceId: SurfaceId
}

export interface CreateCompileCoordinatorOptions {
  registry: RegistryContractSnapshot | unknown
  environment?: Partial<SemanticCompilerEnvironment>
  maxCachedSurfaces?: number
}

export interface CompileCoordinator {
  acceptSnapshot: (snapshot: ProjectSnapshot, changeSet?: ProjectChangeSet) => void
  compileSurface: (surfaceId: SurfaceId) => CompileCanonicalSurfaceResult
  compileDraftSurface: (
    snapshot: ProjectDraftSnapshot,
    surfaceId: SurfaceId,
    changeSet?: ProjectChangeSet,
  ) => CompileCanonicalSurfaceResult
  clear: () => void
}

export type CompileCanonicalProjectResult
  = | { success: true, compilation: ProjectCompilation, diagnostics: [] }
    | { success: false, diagnostics: SemanticCompilerDiagnostic[] }

export type CompileCanonicalSurfaceResult
  = | { success: true, compilation: SurfaceCompilation, diagnostics: [] }
    | { success: false, diagnostics: SemanticCompilerDiagnostic[] }
