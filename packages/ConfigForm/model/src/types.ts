import type {
  ConfigFormFlow,
  ConfigFormFlowEdge,
  ConfigFormFlowNode,
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormReaction,
  ConfigFormReactionCondition,
} from '@moluoxixi/config-form-core'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'

export const PROJECT_DOCUMENT_VERSION = 4 as const
export const PAGE_GRAPH_VERSION = 2 as const
export const REGISTRY_CONTRACT_SNAPSHOT_VERSION = 1 as const

export type ModelJsonValue = ConfigFormJsonValue
export type ModelJsonObject = ConfigFormJsonObject
export type PageId = string
export type NodeId = string
export type SlotName = string
export type ComponentKey = string

export type ConditionTarget = 'visible' | 'hidden' | 'required' | 'disabled' | 'readonly'
export type ConditionExpression = ConfigFormReactionCondition
export type ValidateTrigger = 'submit' | 'blur' | 'change'

export interface RegisteredEventAction extends ModelJsonObject {
  action: string
}

export interface RegisteredBinding extends ModelJsonObject {
  source: string
}

export interface ResponsiveLayoutOverride {
  columns?: number
  fieldSpan?: number
}

export interface ResponsiveLayout {
  tablet?: ResponsiveLayoutOverride
  mobile?: ResponsiveLayoutOverride
}

export interface FormSettings {
  readonly?: boolean
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  responsive?: ResponsiveLayout
}

export interface ComponentPropertyContract {
  key: string
  path: string[]
  valueKind?: string
  required?: boolean
}

export interface ComponentEventContract {
  name: string
}

export interface ComponentBindingContract {
  name: string
  valueProp: string
  trigger: string
}

export interface ComponentSlotContract {
  name: SlotName
  accepts?: Array<'field' | 'layout'>
  components?: ComponentKey[]
}

export interface ComponentParentContract {
  component: ComponentKey
  slot: SlotName
}

export interface ComponentContract {
  key: ComponentKey
  version: string
  kind: 'field' | 'layout'
  props: ComponentPropertyContract[]
  events: ComponentEventContract[]
  bindings: ComponentBindingContract[]
  slots: ComponentSlotContract[]
  allowedParents: ComponentParentContract[]
  defaults: ModelJsonObject
}

export interface ComponentContractRegistry {
  readonly lock: RegistryLock
  get: (key: ComponentKey) => ComponentContract | undefined
  list: () => ComponentContract[]
}

export interface RegistryComponentLock {
  contractVersion: string
  fingerprint: string
}

export interface RegistryLock {
  adapter: string
  version: string
  /** Aggregate identity for diagnostics and cache keys, never compatibility by itself. */
  fingerprint: string
  components: Record<ComponentKey, RegistryComponentLock>
}

export interface RegistryContractComponentSnapshot {
  readonly key: ComponentKey
  readonly contractVersion: string
  readonly fingerprint: string
  readonly contract: DeepReadonly<ComponentContract>
}

/** JSON-safe registry input shared by semantic compiler backends. */
export interface RegistryContractSnapshot {
  readonly schemaVersion: typeof REGISTRY_CONTRACT_SNAPSHOT_VERSION
  readonly adapter: string
  readonly adapterVersion: string
  readonly fingerprint: string
  readonly components: readonly RegistryContractComponentSnapshot[]
}

export type RegistryContractSnapshotParseResult
  = | { success: true, data: RegistryContractSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

interface PageNodeBase {
  id: NodeId
  component: ComponentKey
  props: ModelJsonObject
  events: Record<string, RegisteredEventAction[]>
  bindings: Record<string, RegisteredBinding>
  extensions?: ModelJsonObject
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

/** Layout metadata owned by the parent-child relation, never by the child node. */
export type NodePlacement = ModelJsonObject

export interface SlotItem {
  nodeId: NodeId
  placement: NodePlacement
}

export interface FieldNode extends PageNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface LayoutNode extends PageNodeBase {
  kind: 'layout'
  slots: Record<SlotName, SlotItem[]>
}

export type PageNode = FieldNode | LayoutNode

export interface PageGraph {
  version: typeof PAGE_GRAPH_VERSION
  props: ModelJsonObject
  form: FormSettings
  root: SlotItem[]
  nodesById: Record<NodeId, PageNode>
}

export interface ProjectPage {
  id: PageId
  name: string
  route: string
  graph: PageGraph
  flows?: ConfigFormFlow[]
}

export interface ProjectResourceReference {
  id: string
  kind: string
  uri: string
  integrity?: string
  metadata?: ModelJsonObject
}

export interface ProjectDocument {
  schemaVersion: typeof PROJECT_DOCUMENT_VERSION
  id: string
  name: string
  homePageId: PageId
  pageOrder: PageId[]
  pagesById: Record<PageId, ProjectPage>
  registryLock: RegistryLock
  settings: ModelJsonObject
  resources: Record<string, ProjectResourceReference>
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T

/** Deeply readonly view of the versioned ProjectDocument wire format. */
export type ReadonlyProjectDocument = DeepReadonly<ProjectDocument>

/**
 * Immutable editor identity around one canonical ProjectDocument.
 *
 * `editVersion` is local domain-engine progress. It is intentionally distinct
 * from repository CAS state. `contentHash` identifies semantic document
 * content and excludes persistence revision/timestamp fields.
 */
export interface ProjectSnapshot {
  readonly document: ReadonlyProjectDocument
  readonly editVersion: number
  readonly contentHash: string
}

export interface ProjectDraftSnapshot {
  readonly kind: 'draft'
  readonly draftId: string
  readonly document: ReadonlyProjectDocument
  readonly base: {
    readonly projectId: string
    readonly editVersion: number
    readonly contentHash: string
  }
  readonly draftHash: string
}

/** Compiler input identity; only ProjectSnapshot may enter history or persistence. */
export type ProjectCompilationSnapshot = ProjectSnapshot | ProjectDraftSnapshot

export interface NodeTarget {
  parentId: NodeId | null
  slot?: SlotName
  index?: number
}

export interface NodeSubgraph {
  root: SlotItem[]
  nodesById: Record<NodeId, PageNode>
}

export interface CommonNodeSettings {
  component: ComponentKey
  extensions?: ModelJsonObject
  conditions?: Partial<Record<ConditionTarget, ConditionExpression>>
  reactions?: ConfigFormReaction[]
}

export interface FieldNodeSettings extends CommonNodeSettings {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface LayoutNodeSettings extends CommonNodeSettings {
  kind: 'layout'
}

export type PageNodeSettings = FieldNodeSettings | LayoutNodeSettings

export type ProjectOperation
  = | { type: 'page.add', page: ProjectPage, index?: number }
    | { type: 'page.remove', pageId: PageId }
    | { type: 'page.move', pageId: PageId, index: number }
    | { type: 'page.rename', pageId: PageId, name: string }
    | { type: 'page.route', pageId: PageId, route: string }
    | { type: 'project.home', pageId: PageId }
    | { type: 'project.settings', settings: ModelJsonObject }
    | { type: 'page.props', pageId: PageId, props: ModelJsonObject }
    | { type: 'page.form', pageId: PageId, form: FormSettings }
    | { type: 'node.insert', pageId: PageId, subgraph: NodeSubgraph, target: NodeTarget }
    | { type: 'node.move', pageId: PageId, nodeId: NodeId, target: NodeTarget }
    | { type: 'node.props', pageId: PageId, nodeId: NodeId, props: ModelJsonObject }
    | { type: 'node.events', pageId: PageId, nodeId: NodeId, events: Record<string, RegisteredEventAction[]> }
    | { type: 'node.bindings', pageId: PageId, nodeId: NodeId, bindings: Record<string, RegisteredBinding> }
    | { type: 'node.placement', pageId: PageId, nodeId: NodeId, placement: NodePlacement }
    | { type: 'node.settings', pageId: PageId, nodeId: NodeId, settings: PageNodeSettings }
    | { type: 'node.remove', pageId: PageId, nodeId: NodeId }
    | { type: 'flow.add', pageId: PageId, flow: ConfigFormFlow, index?: number }
    | { type: 'flow.update', pageId: PageId, flowId: string, flow: ConfigFormFlow }
    | { type: 'flow.remove', pageId: PageId, flowId: string }

export interface ProjectNodePatchValues {
  conditions: Partial<Record<ConditionTarget, ConditionExpression>>
  defaultValue: ModelJsonValue
  extensions: ModelJsonObject
  field: string
  label: string
  reactions: ConfigFormReaction[]
  validateOn: ValidateTrigger | ValidateTrigger[]
  validation: RuleSet
}

export type ProjectNodePatchKey = keyof ProjectNodePatchValues

/**
 * JSON-safe semantic patch. `unset` is explicit because `undefined` is lost
 * across postMessage, JSON persistence, and command replay boundaries.
 */
export interface ProjectNodePatch {
  set?: Partial<ProjectNodePatchValues>
  unset?: ProjectNodePatchKey[]
}

export type ProjectFlowSettings = Pick<
  ConfigFormFlow,
  'name' | 'trigger' | 'concurrency' | 'errorPolicy'
>

/**
 * User intent accepted by the domain command boundary. Actions may be
 * resolved against the current snapshot before one atomic transaction is
 * applied. Low-level operations remain available for already-normalized UI
 * intents; commands such as duplicate and patch deliberately stay semantic.
 */
export type ProjectCommandAction
  = | { type: 'operation.apply', operations: ProjectOperation[] }
    | { type: 'node.patch', pageId: PageId, nodeId: NodeId, patch: ProjectNodePatch }
    | { type: 'node.resize', pageId: PageId, nodeId: NodeId, span: number | null }
    | {
      type: 'node.duplicate'
      pageId: PageId
      nodeId: NodeId
      target: NodeTarget
      idMap: Record<NodeId, NodeId>
      fieldMap?: Record<string, string>
    }
    | { type: 'flow.settings', pageId: PageId, flowId: string, settings: ProjectFlowSettings }
    | { type: 'flow.node', pageId: PageId, flowId: string, nodeId: string, node: ConfigFormFlowNode }
    | { type: 'flow.edges', pageId: PageId, flowId: string, edges: ConfigFormFlowEdge[] }
    | {
      type: 'flow.graph'
      pageId: PageId
      flowId: string
      nodes: ConfigFormFlowNode[]
      edges: ConfigFormFlowEdge[]
    }
    | { type: 'flow.replaceAll', pageId: PageId, flows?: ConfigFormFlow[] }

export interface ProjectCommand {
  id: string
  label: string
  actions: ProjectCommandAction[]
  mergeKey?: string
}

export type ProjectCommandResolution
  = | { success: true, transaction: ProjectTransaction }
    | { success: false, diagnostics: ModelDiagnostic[] }

export interface ProjectTransaction {
  id: string
  label: string
  operations: ProjectOperation[]
  mergeKey?: string
}

export interface ModelDiagnostic {
  code: string
  message: string
  path?: Array<string | number>
  pageId?: PageId
  nodeId?: NodeId
}

export interface ProjectTransactionSuccess {
  success: true
  changed: boolean
  document: ProjectDocument
  inverse: ProjectTransaction
  diagnostics: ModelDiagnostic[]
  changedProject: boolean
  changedPageIds: PageId[]
  changedNodeIds: NodeId[]
}

export interface ProjectTransactionFailure {
  success: false
  document: ProjectDocument
  diagnostics: ModelDiagnostic[]
}

export type ProjectTransactionResult = ProjectTransactionSuccess | ProjectTransactionFailure

export interface AppliedProjectTransaction {
  transaction: ProjectTransaction
  inverse: ProjectTransaction
  editVersion: number
  contentHash: string
  timestamp: number
}

export interface ProjectHistory {
  snapshot: ProjectSnapshot
  /** @deprecated Use snapshot.document. */
  present: ProjectDocument
  past: AppliedProjectTransaction[]
  future: AppliedProjectTransaction[]
  limit: number
  mergeWindowMs: number
}

export interface ProjectHistoryResult {
  changed: boolean
  history: ProjectHistory
  diagnostics: ModelDiagnostic[]
  changeSet: ProjectChangeSet
}

export interface ProjectChangeSet {
  project: boolean
  pageIds: readonly PageId[]
  nodeIds: readonly NodeId[]
}
