import type {
  ConfigFormJsonObject,
  ConfigFormJsonValue,
  ConfigFormScopedFieldDefinition,
  ConfigFormScopePath,
  ConfigFormScopeSelector,
  ConfigFormValueScopeDefinition,
} from '@moluoxixi/config-form-core'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import type {
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  PROJECT_TRANSFER_VERSION,
  REGISTRY_CONTRACT_SNAPSHOT_VERSION,
  SURFACE_GRAPH_VERSION,
  SURFACE_TRANSFER_VERSION,
} from '../constants'

export type ModelJsonValue = ConfigFormJsonValue
export type ModelJsonObject = ConfigFormJsonObject
export type ProjectId = string
export type SurfaceId = string
export type DatasetId = string
export type ResourceId = string
export type InteractionRuleId = string
export type SurfaceInstanceId = string
export type NodeId = string
export type SlotName = string
export type ComponentKey = string
export type ValidateTrigger = 'submit' | 'blur' | 'change'

export interface ResponsiveLayoutOverride {
  columns?: number
  fieldSpan?: number
  labelWidth?: number
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
  labelWidth?: number
  responsive?: ResponsiveLayout
}

export type MaterialNodeKind = 'field' | 'layout' | 'element'
export type MaterialSemanticTrigger = 'activate' | 'submit' | 'rowActivate' | 'itemActivate'

export interface ComponentPropertyContract {
  key: string
  path: string[]
  valueKind?: string
  required?: boolean
}

export interface ComponentBindingContract {
  name: string
  valueProp: string
  trigger: string
}

export interface ComponentSlotContract {
  name: SlotName
  accepts?: MaterialNodeKind[]
  components?: ComponentKey[]
}

export interface ComponentParentContract {
  component: ComponentKey
  slot: SlotName
}

export interface MaterialDatasetBindingCapability {
  key: string
  projectionKinds: DatasetProjection['kind'][]
}

export interface MaterialResourceBindingCapability {
  key: string
  mediaTypes?: string[]
}

export interface MaterialCapabilitiesV3 {
  kind: MaterialNodeKind
  semanticTriggers: MaterialSemanticTrigger[]
  stateProjectionProperties: string[][]
  datasetBindings: MaterialDatasetBindingCapability[]
  resourceBindings: MaterialResourceBindingCapability[]
}

export interface ComponentContract extends MaterialCapabilitiesV3 {
  key: ComponentKey
  version: string
  props: ComponentPropertyContract[]
  bindings: ComponentBindingContract[]
  slots: ComponentSlotContract[]
  allowedParents: ComponentParentContract[]
  defaults: ModelJsonObject
}

export interface ComponentContractRegistry {
  readonly lock: RegistryLock
  analyzeLock: (lock: RegistryLock) => ModelDiagnostic[]
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
  fingerprint: string
  components: Record<ComponentKey, RegistryComponentLock>
}

export interface RegistryContractComponentSnapshot {
  readonly key: ComponentKey
  readonly contractVersion: string
  readonly fingerprint: string
  readonly contract: DeepReadonly<ComponentContract>
}

export interface RegistryContractSnapshot {
  readonly version: typeof REGISTRY_CONTRACT_SNAPSHOT_VERSION
  readonly adapter: string
  readonly adapterVersion: string
  readonly fingerprint: string
  readonly components: readonly RegistryContractComponentSnapshot[]
}

export type RegistryContractSnapshotParseResult
  = | { success: true, data: RegistryContractSnapshot, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type NodePlacement = ModelJsonObject

export interface SlotItem {
  nodeId: NodeId
  placement: NodePlacement
}

export interface DatasetOptionsProjection {
  kind: 'options'
  labelPath: string[]
  valuePath: string[]
  disabledPath?: string[]
}

export interface DatasetTableProjection {
  kind: 'table'
  rowKeyPath: string[]
  columns: Array<{ key: string, valuePath: string[] }>
}

export interface DatasetListProjection {
  kind: 'list'
  itemKeyPath: string[]
  titlePath?: string[]
  descriptionPath?: string[]
}

export type DatasetProjection = DatasetOptionsProjection | DatasetTableProjection | DatasetListProjection

export interface DatasetReference<T extends DatasetProjection = DatasetProjection> {
  datasetId: DatasetId
  projection: T
}

export interface StaticResourceReference {
  resourceId: ResourceId
}

interface SurfaceNodeBase {
  id: NodeId
  component: ComponentKey
  props: ModelJsonObject
  extensions?: ModelJsonObject
  datasetBindings?: Record<string, DatasetReference>
  resourceBindings?: Record<string, StaticResourceReference>
}

export interface SurfaceFieldNode extends SurfaceNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  required?: boolean
  requiredMessage?: string
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface SurfaceLayoutNode extends SurfaceNodeBase {
  kind: 'layout'
  slots: Record<SlotName, SlotItem[]>
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

export interface SurfaceElementNode extends SurfaceNodeBase {
  kind: 'element'
}

export type SurfaceNode = SurfaceFieldNode | SurfaceLayoutNode | SurfaceElementNode
export type FieldNode = SurfaceFieldNode
export type LayoutNode = SurfaceLayoutNode
export type ElementNode = SurfaceElementNode

export interface SurfaceGraph {
  version: typeof SURFACE_GRAPH_VERSION
  props: ModelJsonObject
  form: FormSettings
  root: SlotItem[]
  nodesById: Record<NodeId, SurfaceNode>
}

export interface ProjectDataset {
  id: DatasetId
  name: string
  description?: string
  rows: ModelJsonObject[]
  defaultProjection?: DatasetProjection
}

export interface ControlledLength {
  value: number
  unit: 'px' | '%' | 'rem' | 'vw' | 'vh'
}

export interface ResponsiveLength {
  desktop: ControlledLength
  tablet?: ControlledLength
  mobile?: ControlledLength
}

export type ProjectThemeColor = string
export type ProjectThemeSpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ProjectThemeRadiusKey = 'sm' | 'md' | 'lg'
export type ProjectThemeShadowKey = 'sm' | 'md' | 'lg'

export interface ProjectThemeShadow {
  x: number
  y: number
  blur: number
  spread: number
  color: ProjectThemeColor
}

export interface ProjectTheme {
  version: typeof PROJECT_THEME_VERSION
  colors?: Partial<Record<
    | 'primary' | 'success' | 'warning' | 'danger' | 'text' | 'textMuted'
    | 'canvas' | 'surface' | 'surfaceRaised' | 'border',
    ProjectThemeColor
  >>
  typography?: {
    family?: 'system' | 'sans-serif' | 'serif' | 'monospace'
    baseSize?: number
    lineHeight?: number
    bodyWeight?: 400 | 500 | 600 | 700
    headingWeight?: 400 | 500 | 600 | 700
  }
  spacing?: Partial<Record<ProjectThemeSpacingKey, number>>
  border?: { width?: number, style?: 'solid' | 'dashed' }
  radius?: Partial<Record<ProjectThemeRadiusKey, number>>
  shadows?: Partial<Record<ProjectThemeShadowKey, ProjectThemeShadow>>
}

export interface SurfaceParameterDefinition {
  name: string
  required: boolean
  defaultValue?: ModelJsonValue
}

export interface SurfaceOutputDefinition {
  name: string
}

export type SafeExpressionReferenceScope = 'values' | 'parameters' | 'result' | 'item'
export type SafeExpressionFunction
  = | 'coalesce' | 'length' | 'trim' | 'lower' | 'upper'
    | 'includes' | 'startsWith' | 'endsWith'

export type SafeExpressionNode
  = | { kind: 'literal', value: ModelJsonValue }
    | { kind: 'reference', scope: 'values', selector?: ConfigFormScopeSelector, path: string[] }
    | { kind: 'reference', scope: Exclude<SafeExpressionReferenceScope, 'values'>, path: string[] }
    | { kind: 'array', items: SafeExpressionNode[] }
    | { kind: 'unary', operator: '!' | '-' | '+', operand: SafeExpressionNode }
    | {
      kind: 'binary'
      operator: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '>=' | '<' | '<=' | '&&' | '||'
      left: SafeExpressionNode
      right: SafeExpressionNode
    }
    | { kind: 'conditional', test: SafeExpressionNode, consequent: SafeExpressionNode, alternate: SafeExpressionNode }
    | { kind: 'call', callee: SafeExpressionFunction, args: SafeExpressionNode[] }

export interface SafeExpression {
  version: 1
  ast: SafeExpressionNode
}

export type StateProjectionTarget
  = | { kind: 'state', nodeId: NodeId, key: 'visible' | 'disabled' | 'readonly' | 'required' }
    | { kind: 'property', nodeId: NodeId, path: string[] }

export interface StateProjectionRule {
  kind: 'stateProjection'
  id: InteractionRuleId
  target: StateProjectionTarget
  value: SafeExpression
}

export type ValueAction
  = | { kind: 'set', targetFieldId: NodeId, value: SafeExpression }
    | { kind: 'copy', sourceFieldId: NodeId, targetFieldId: NodeId }
    | { kind: 'clear', targetFieldId: NodeId }

export interface ValueChangeRule {
  kind: 'valueChange'
  id: InteractionRuleId
  dependencies: NodeId[]
  when?: SafeExpression
  action: ValueAction
}

export interface ValidationGate {
  scope: 'surface' | 'fields'
  fieldIds?: NodeId[]
}

export interface SurfaceParameterBinding {
  name: string
  value: SafeExpression
}

export interface ResultAssignment {
  targetFieldId: NodeId
  value: SafeExpression
}

export interface NamedResultBinding {
  resultName: string
  assignments: ResultAssignment[]
}

export type PrimaryUiAction
  = | { kind: 'navigate', targetSurfaceId: SurfaceId, parameters: SurfaceParameterBinding[] }
    | { kind: 'back' }
    | {
      kind: 'open'
      targetSurfaceId: SurfaceId
      parameters: SurfaceParameterBinding[]
      onResults?: NamedResultBinding[]
    }
    | { kind: 'closeCurrent', result?: { name: string, value: SafeExpression } }
    | { kind: 'closeAll' }

export interface PrimaryUiActionBinding {
  kind: 'primaryUiAction'
  id: InteractionRuleId
  nodeId: NodeId
  trigger: MaterialSemanticTrigger
  validate?: ValidationGate
  action: PrimaryUiAction
}

export type PrototypeInteraction = StateProjectionRule | ValueChangeRule | PrimaryUiActionBinding

export interface ProjectSurfaceBase {
  id: SurfaceId
  name: string
  graph: SurfaceGraph
  parameters: SurfaceParameterDefinition[]
  outputs: SurfaceOutputDefinition[]
  interactions: PrototypeInteraction[]
}

export interface ProjectPageSurface extends ProjectSurfaceBase {
  kind: 'page'
  route: string
}

export interface SurfaceClosePolicy {
  escape: boolean
  mask: boolean
  button: boolean
}

export interface ProjectDialogSurface extends ProjectSurfaceBase {
  kind: 'dialog'
  presentation: {
    kind: 'dialog'
    title: string
    width: ResponsiveLength
    mask: boolean
    close: SurfaceClosePolicy
  }
}

export interface ProjectDrawerSurface extends ProjectSurfaceBase {
  kind: 'drawer'
  presentation: {
    kind: 'drawer'
    title: string
    placement: 'left' | 'right' | 'top' | 'bottom'
    size: ResponsiveLength
    mask: boolean
    close: SurfaceClosePolicy
  }
}

export type ProjectSurface = ProjectPageSurface | ProjectDialogSurface | ProjectDrawerSurface

export interface ProjectEmbeddedResource {
  id: ResourceId
  name: string
  kind: 'embedded'
  fileName: string
  mediaType: string
  byteLength: number
  contentHash: string
}

export interface ProjectUrlResource {
  id: ResourceId
  name: string
  kind: 'url'
  url: string
  mediaType?: string
  integrity?: string
}

export type ProjectResource = ProjectEmbeddedResource | ProjectUrlResource

export interface ProjectDocument {
  version: typeof PROJECT_DOCUMENT_VERSION
  id: ProjectId
  name: string
  homeSurfaceId: SurfaceId
  surfaceOrder: SurfaceId[]
  surfacesById: Record<SurfaceId, ProjectSurface>
  datasetOrder: DatasetId[]
  datasetsById: Record<DatasetId, ProjectDataset>
  resources: Record<ResourceId, ProjectResource>
  theme: ProjectTheme
  registryLock: RegistryLock
  settings: ModelJsonObject
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [infer Head, ...infer Tail]
    ? readonly [DeepReadonly<Head>, ...DeepReadonly<Tail>]
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T

export type ReadonlyProjectDocument = DeepReadonly<ProjectDocument>

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
    readonly projectId: ProjectId
    readonly editVersion: number
    readonly contentHash: string
  }
  readonly draftHash: string
}

export type ProjectCompilationSnapshot = ProjectSnapshot | ProjectDraftSnapshot

export interface NodeTarget {
  parentId: NodeId | null
  slot?: SlotName
  index?: number
}

export interface NodeSubgraph {
  root: SlotItem[]
  nodesById: Record<NodeId, SurfaceNode>
}

export interface CommonNodeSettings {
  component: ComponentKey
  extensions?: ModelJsonObject
  datasetBindings?: Record<string, DatasetReference>
  resourceBindings?: Record<string, StaticResourceReference>
}

export interface FieldNodeSettings extends CommonNodeSettings {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: ModelJsonValue
  required?: boolean
  requiredMessage?: string
  validation?: RuleSet
  validateOn?: ValidateTrigger | ValidateTrigger[]
}

export interface LayoutNodeSettings extends CommonNodeSettings {
  kind: 'layout'
  valueScope?: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

export interface ElementNodeSettings extends CommonNodeSettings {
  kind: 'element'
}

export type SurfaceNodeSettings = FieldNodeSettings | LayoutNodeSettings | ElementNodeSettings

export type ProjectOperation
  = | { type: 'surface.add' | 'surface.copy', surface: ProjectSurface, index?: number }
    | { type: 'surface.remove', surfaceId: SurfaceId }
    | { type: 'surface.move', surfaceId: SurfaceId, index: number }
    | { type: 'surface.rename', surfaceId: SurfaceId, name: string }
    | { type: 'surface.route', surfaceId: SurfaceId, route: string }
    | { type: 'surface.presentation', surfaceId: SurfaceId, presentation: ProjectDialogSurface['presentation'] | ProjectDrawerSurface['presentation'] }
    | { type: 'surface.parameters', surfaceId: SurfaceId, parameters: SurfaceParameterDefinition[] }
    | { type: 'surface.outputs', surfaceId: SurfaceId, outputs: SurfaceOutputDefinition[] }
    | { type: 'surface.interactions', surfaceId: SurfaceId, interactions: PrototypeInteraction[] }
    | { type: 'project.home', surfaceId: SurfaceId }
    | { type: 'project.settings', settings: ModelJsonObject }
    | { type: 'project.theme', theme: ProjectTheme }
    | { type: 'surface.props', surfaceId: SurfaceId, props: ModelJsonObject }
    | { type: 'surface.form', surfaceId: SurfaceId, form: FormSettings }
    | { type: 'dataset.add' | 'dataset.copy', dataset: ProjectDataset, index?: number }
    | { type: 'dataset.remove', datasetId: DatasetId }
    | { type: 'dataset.move', datasetId: DatasetId, index: number }
    | { type: 'dataset.rename', datasetId: DatasetId, name: string }
    | { type: 'dataset.replaceRows', datasetId: DatasetId, rows: ModelJsonObject[] }
    | { type: 'dataset.setDefaultProjection', datasetId: DatasetId, projection?: DatasetProjection }
    | { type: 'resource.add', resource: ProjectResource }
    | { type: 'resource.remove', resourceId: ResourceId }
    | { type: 'resource.rename', resourceId: ResourceId, name: string }
    | { type: 'resource.replace', resourceId: ResourceId, resource: ProjectResource }
    | { type: 'node.insert', surfaceId: SurfaceId, subgraph: NodeSubgraph, target: NodeTarget }
    | { type: 'node.move', surfaceId: SurfaceId, nodeId: NodeId, target: NodeTarget }
    | { type: 'node.props', surfaceId: SurfaceId, nodeId: NodeId, props: ModelJsonObject }
    | { type: 'node.placement', surfaceId: SurfaceId, nodeId: NodeId, placement: NodePlacement }
    | { type: 'node.settings', surfaceId: SurfaceId, nodeId: NodeId, settings: SurfaceNodeSettings }
    | { type: 'node.remove', surfaceId: SurfaceId, nodeId: NodeId }

export interface ProjectNodePatchValues {
  datasetBindings: Record<string, DatasetReference>
  defaultValue: ModelJsonValue
  extensions: ModelJsonObject
  field: string
  label: string
  required: boolean
  requiredMessage: string
  resourceBindings: Record<string, StaticResourceReference>
  validateOn: ValidateTrigger | ValidateTrigger[]
  validation: RuleSet
  valueScope: Omit<ConfigFormValueScopeDefinition, 'nodeId' | 'parentId'>
}

export type ProjectNodePatchKey = keyof ProjectNodePatchValues

export interface ProjectNodePatch {
  set?: Partial<ProjectNodePatchValues>
  unset?: ProjectNodePatchKey[]
}

export type ProjectCommandAction
  = | { type: 'operation.apply', operations: ProjectOperation[] }
    | { type: 'node.patch', surfaceId: SurfaceId, nodeId: NodeId, patch: ProjectNodePatch }
    | { type: 'node.resize', surfaceId: SurfaceId, nodeId: NodeId, span: number | null }
    | {
      type: 'node.duplicate'
      surfaceId: SurfaceId
      nodeId: NodeId
      target: NodeTarget
      idMap: Record<NodeId, NodeId>
      fieldMap?: Record<string, string>
    }

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
  projectId?: ProjectId
  surfaceId?: SurfaceId
  datasetId?: DatasetId
  resourceId?: ResourceId
  nodeId?: NodeId
  context?: Record<string, unknown>
}

export interface ProjectTransactionSuccess {
  success: true
  changed: boolean
  document: ProjectDocument
  inverse: ProjectTransaction
  diagnostics: ModelDiagnostic[]
  changeSet: ProjectChangeSet
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
  surfaceIds: readonly SurfaceId[]
  datasetIds: readonly DatasetId[]
  resourceIds: readonly ResourceId[]
  nodeChanges: readonly ProjectNodeChange[]
}

export interface ProjectNodeRelation {
  parentId: NodeId | null
  slot: SlotName | null
}

export interface ProjectNodeChange {
  surfaceId: SurfaceId
  nodeId: NodeId
  kind: 'content' | 'insert' | 'move' | 'remove'
  before?: ProjectNodeRelation
  after?: ProjectNodeRelation
}

export interface SurfaceValueSchema {
  valueScopes: ConfigFormValueScopeDefinition[]
  scopedFields: ConfigFormScopedFieldDefinition[]
}

export interface PrototypeNodeAddressV1 {
  nodeId: NodeId
  scope: ConfigFormScopePath
}

export interface PrototypeSurfaceTopologyV1 {
  nodeOrder: NodeId[]
  ownerScopeIdByNodeId: Record<NodeId, NodeId | null>
  valueScopes: ConfigFormValueScopeDefinition[]
  scopedFields: ConfigFormScopedFieldDefinition[]
}

export interface PrototypeFieldInstanceAddressV1 {
  address: PrototypeNodeAddressV1
  valuePath: Array<string | number>
}

export interface PrototypeInstanceRuntimeSnapshotV1 {
  nodeAddresses: PrototypeNodeAddressV1[]
  fieldInstances: PrototypeFieldInstanceAddressV1[]
}

export interface ResourceTransferContentV1 {
  encoding: 'base64'
  data: string
}

export interface ProjectEmbeddedResourceRead {
  projectId: ProjectId
  resourceId: ResourceId
  contentHash: string
}

export interface ProjectTransferEnvelopeV1 {
  kind: 'config-form-project'
  version: typeof PROJECT_TRANSFER_VERSION
  document: ProjectDocument
  embeddedContents: Array<{ resourceId: ResourceId, content: ResourceTransferContentV1 }>
}

export interface ProjectTransferReadResultV1 {
  document: ProjectDocument
  embeddedBytesByResourceId: Readonly<Record<ResourceId, Uint8Array>>
}

export interface ProjectTransferWriteInputV1 {
  document: ReadonlyProjectDocument
  readEmbedded: (input: ProjectEmbeddedResourceRead) => Promise<Uint8Array | undefined>
}

export interface SurfaceTransferEnvelopeV1 {
  kind: 'config-form-surface'
  version: typeof SURFACE_TRANSFER_VERSION
  rootSurfaceId: SurfaceId
  surfaceOrder: SurfaceId[]
  surfacesById: Record<SurfaceId, ProjectSurface>
  datasetOrder: DatasetId[]
  datasetsById: Record<DatasetId, ProjectDataset>
  resources: Record<ResourceId, ProjectResource>
  embeddedContents: Array<{ resourceId: ResourceId, content: ResourceTransferContentV1 }>
  registryLock: RegistryLock
}

export interface SurfaceTransferReadResultV1 extends Omit<SurfaceTransferEnvelopeV1, 'kind' | 'version' | 'embeddedContents'> {
  embeddedBytesByResourceId: Readonly<Record<ResourceId, Uint8Array>>
}

export interface SurfaceTransferWriteInputV1 extends ProjectTransferWriteInputV1 {
  rootSurfaceId: SurfaceId
}

export type ContractResult<T>
  = | { success: true, data: T, diagnostics: [] }
    | { success: false, diagnostics: ModelDiagnostic[] }

export type ProjectReferenceTargetKind = 'surface' | 'dataset' | 'resource' | 'node'
export type ProjectReferenceSourceKind
  = | 'project-home'
    | 'node-dataset-binding'
    | 'node-resource-binding'
    | 'interaction-node'
    | 'interaction-field'
    | 'interaction-surface'

export interface ProjectReference {
  sourceKind: ProjectReferenceSourceKind
  targetKind: ProjectReferenceTargetKind
  targetId: string
  path: Array<string | number>
  sourceSurfaceId?: SurfaceId
  nodeId?: NodeId
  interactionId?: InteractionRuleId
}

export interface SurfaceDependencyClosure {
  surfaceIds: SurfaceId[]
  datasetIds: DatasetId[]
  resourceIds: ResourceId[]
}
