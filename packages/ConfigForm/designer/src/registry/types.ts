import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'
import type {
  DesignerContainerNode,
  DesignerDiagnostic,
  DesignerFieldNode,
  DesignerJsonObject,
  DesignerJsonValue,
  DesignerNode,
  DesignerNodeKind,
} from '../document'

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
  value: DesignerJsonValue
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

export interface DesignerRuntimeMaterialBinding {
  component: Component | string
  designerComponent?: Component | string
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
  staticProps?: DesignerJsonObject
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
  /** Human-readable reason shown by the editor diagnostic overlay. */
  diagnostic?: string
}

export interface DesignerResolvedDesignPolicy {
  render: 'runtime' | 'adapter'
  interaction: 'preview' | 'blocked'
  async: 'blocked' | 'adapter'
  sideEffects: 'blocked' | 'adapter'
  adapter?: Component | string
  diagnostic?: string
}

export interface DesignerReadonlyRenderContext {
  node: DesignerFieldNode
  model: Record<string, unknown>
  value: unknown
  componentProps: Record<string, unknown>
}

export type DesignerReadonlyRender = (context: DesignerReadonlyRenderContext) => VNodeChild

export interface DesignerCreateNodeContext {
  id: string
  field?: string
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
  /** When present, the material is structural and may only exist in these parent slots. */
  allowedParents?: DesignerMaterialParentDefinition[]
  setters: DesignerPropertySetterDefinition[]
  analyze?: (node: Extract<DesignerNode, { kind: TKind }>, path: (string | number)[]) => DesignerDiagnostic[]
}

export interface DesignerFieldMaterialDefinition extends DesignerMaterialDefinitionBase<'field'> {
  createNode: (context: DesignerCreateNodeContext) => DesignerFieldNode
}

export interface DesignerContainerMaterialDefinition extends DesignerMaterialDefinitionBase<'container'> {
  createNode: (context: DesignerCreateNodeContext) => DesignerContainerNode
  slots: DesignerMaterialSlotDefinition[]
}

export type DesignerMaterialDefinition = DesignerFieldMaterialDefinition | DesignerContainerMaterialDefinition

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
  createNode: (key: string, context: DesignerCreateNodeContext) => DesignerNode
}
