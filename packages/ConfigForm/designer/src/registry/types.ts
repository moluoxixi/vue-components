import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type {
  ComponentContract,
  FieldNode,
  LayoutNode,
  ModelJsonObject,
  ModelJsonValue,
  NodeSubgraph,
  PageNode,
} from '@moluoxixi/config-form-model'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'
import type { DesignerDiagnostic } from '../graph'

export type DesignerNodeKind = PageNode['kind']

export type DesignerSetterControl
  = | 'text'
    | 'textarea'
    | 'number'
    | 'boolean'
    | 'select'
    | 'defaultValue'
    | 'options'
    | 'condition'
    | 'reaction'
    | 'validation'
    | 'custom'

export type DesignerSimpleSetterControl = Extract<
  DesignerSetterControl,
  'text' | 'textarea' | 'number' | 'boolean' | 'select'
>

export type DesignerDefaultValueKind
  = | 'text'
    | 'number'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'date'
    | 'time'

export interface DesignerSetterOption {
  label: string
  value: ModelJsonValue
}

export interface DesignerPropertySetterDefinition {
  key: string
  label: string
  path: string[]
  control: DesignerSetterControl
  options?: DesignerSetterOption[]
  optionsPath?: string[]
  optionSourcePath?: string[]
  valueKind?: DesignerDefaultValueKind
  min?: number
  max?: number
  step?: number
  component?: Component | string
  componentProps?: Record<string, unknown>
}

export interface DesignerPropertyControlDefinition {
  component: Component | string
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  props?: Record<string, unknown>
  getValueFromEvent?: (...args: unknown[]) => unknown
}

export type DesignerPropertyControlRegistry = Partial<
  Record<DesignerSimpleSetterControl, DesignerPropertyControlDefinition>
>

export interface DesignerMaterialSlotDefinition {
  name: string
  title: string
  accepts?: DesignerNodeKind[]
  materials?: string[]
  min?: number
  max?: number
}

export interface DesignerMaterialParentDefinition {
  material: string
  slot: string
}

/** Component event that may be selected as a Flow trigger. */
export interface DesignerMaterialEventDefinition {
  name: string
  title: string
}

export interface DesignerRuntimeMaterialBinding {
  component: Component | string
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  readonlyProp?: string
  readonlyRender?: DesignerReadonlyRender
  getValueFromEvent?: (...args: unknown[]) => unknown
}

export interface DesignerSourceLibraryBinding {
  packageName: string
  plugin: string
  stylesheet?: string
}

export interface DesignerSourceOptionsBinding {
  mode: 'prop' | 'children'
  optionTag?: string
  labelProp?: string
  valueProp?: string
}

export type DesignerSourceRenderKind
  = | 'component'
    | 'layout-flex'
    | 'layout-grid'
    | 'section'

/** Serializable instructions used by Config and standalone Vue source projections. */
export interface DesignerSourceMaterialBinding {
  configComponent: string
  tag: string
  render: DesignerSourceRenderKind
  library?: DesignerSourceLibraryBinding
  options?: DesignerSourceOptionsBinding
  staticProps?: ModelJsonObject
}

export interface DesignerDesignPolicy {
  /** Use the real runtime component unless an explicit controlled adapter is required. */
  render?: 'runtime' | 'adapter'
  /** Preview interactions are enabled only while the Designer interaction tool is active. */
  interaction?: 'preview' | 'blocked'
  /** Async and side-effectful components must render through a controlled adapter. */
  async?: 'blocked' | 'adapter'
  sideEffects?: 'blocked' | 'adapter'
  adapter?: Component | string
  /** Adapter must preserve the Runtime component's visible box geometry. */
  visualEquivalence?: 'runtime-geometry'
  /** Human-readable reason shown by the editor diagnostic overlay. */
  diagnostic?: string
}

export interface DesignerResolvedDesignPolicy {
  render: 'runtime' | 'adapter'
  interaction: 'preview' | 'blocked'
  async: 'blocked' | 'adapter'
  sideEffects: 'blocked' | 'adapter'
  adapter?: Component | string
  visualEquivalence?: 'runtime-geometry'
  diagnostic?: string
}

export interface DesignerReadonlyRenderContext {
  node: FieldNode
  model: Record<string, unknown>
  value: unknown
  componentProps: Record<string, unknown>
}

export type DesignerReadonlyRender = (context: DesignerReadonlyRenderContext) => VNodeChild

export interface DesignerCreateNodeContext {
  id: string
  field?: string
}

type DesignerOptionalNodeMaps = 'props' | 'events' | 'bindings'
export type DesignerFieldNodeTemplate = Omit<FieldNode, DesignerOptionalNodeMaps>
  & Partial<Pick<FieldNode, DesignerOptionalNodeMaps>>
export type DesignerLayoutNodeTemplate = Omit<LayoutNode, DesignerOptionalNodeMaps>
  & Partial<Pick<LayoutNode, DesignerOptionalNodeMaps>>
export interface DesignerNodeSubgraphTemplate {
  root: NodeSubgraph['root']
  nodesById: Record<string, DesignerFieldNodeTemplate | DesignerLayoutNodeTemplate>
}

export interface DesignerMaterialDefinitionBase<TKind extends DesignerNodeKind> {
  key: string
  version: number
  kind: TKind
  title: string
  category: string
  icon?: Component
  runtime: DesignerRuntimeMaterialBinding
  source?: DesignerSourceMaterialBinding
  designPolicy?: DesignerDesignPolicy
  /** Explicit non-binding events exposed to Flow orchestration. */
  events?: DesignerMaterialEventDefinition[]
  /** When present, the material is structural and may only exist in these parent slots. */
  allowedParents?: DesignerMaterialParentDefinition[]
  setters: DesignerPropertySetterDefinition[]
  analyze?: (node: Extract<PageNode, { kind: TKind }>, path: (string | number)[]) => DesignerDiagnostic[]
}

export interface DesignerFieldMaterialDefinition extends DesignerMaterialDefinitionBase<'field'> {
  createNode: (context: DesignerCreateNodeContext) => DesignerFieldNodeTemplate
}

export interface DesignerLayoutMaterialDefinition extends DesignerMaterialDefinitionBase<'layout'> {
  createNode: (context: DesignerCreateNodeContext) => DesignerLayoutNodeTemplate | DesignerNodeSubgraphTemplate
  slots: DesignerMaterialSlotDefinition[]
}

export type DesignerMaterialDefinition = DesignerFieldMaterialDefinition | DesignerLayoutMaterialDefinition

/** Runtime resolver entry. Vue components and functions never enter the contract snapshot. */
export interface DesignerMaterialRuntimeBinding {
  component: string
  contractVersion: string
  kind: DesignerNodeKind
  binding: DesignerRuntimeMaterialBinding
}

/** Designer-only metadata projected from an adapter material declaration. */
export interface DesignerMaterialDesignMetadata {
  component: string
  contractVersion: string
  kind: DesignerNodeKind
  title: string
  category: string
  icon?: Component
  setters: DesignerPropertySetterDefinition[]
  events: DesignerMaterialEventDefinition[]
  slots: DesignerMaterialSlotDefinition[]
  policy?: DesignerDesignPolicy
}

/** Source generator entry. It is serializable apart from the resolver function that owns it. */
export interface DesignerMaterialSourceBinding {
  component: string
  contractVersion: string
  binding: DesignerSourceMaterialBinding
  defaultValue?: ModelJsonValue
  trigger?: string
  valueProp?: string
}

/** Internal four-capability split assembled once at the adapter composition root. */
export interface DesignerMaterialCapabilities {
  contract: ComponentContract
  runtime: DesignerMaterialRuntimeBinding
  design: DesignerMaterialDesignMetadata
  source?: DesignerMaterialSourceBinding
}

export interface DesignerMaterialCapabilityRegistry {
  capabilities: readonly DesignerMaterialCapabilities[]
  contracts: readonly ComponentContract[]
  get: (component: string) => DesignerMaterialCapabilities | undefined
}

export interface DesignerRegistryLayer {
  name: string
  /** ConfigForm 字符串组件别名；靠前 layer 的同名注册优先。 */
  components?: ConfigFormComponentRegistry
  materials?: Iterable<DesignerMaterialDefinition>
  propertyControls?: DesignerPropertyControlRegistry
  validators?: Record<string, RuleCustomValidator>
}

export interface DesignerRegistryOptions {
  rendererNamespace?: string
}

export interface DesignerRegistry {
  rendererNamespace: string
  components: ConfigFormComponentRegistry
  propertyControls: DesignerPropertyControlRegistry
  getMaterial: (key: string) => DesignerMaterialDefinition | undefined
  getValidator: (key: string) => RuleCustomValidator | undefined
  listMaterials: () => DesignerMaterialDefinition[]
  listValidators: () => string[]
  createSubgraph: (key: string, context: DesignerCreateNodeContext) => NodeSubgraph
}
