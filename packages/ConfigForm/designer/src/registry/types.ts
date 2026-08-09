import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component, VNodeChild } from 'vue'
import type {
  DesignerContainerNode,
  DesignerDiagnostic,
  DesignerFieldNode,
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
    | 'validation'
    | 'custom'

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
  component?: Component
  componentProps?: Record<string, unknown>
}

export interface DesignerMaterialSlotDefinition {
  name: string
  title: string
  accepts?: DesignerNodeKind[]
  materials?: string[]
  min?: number
  max?: number
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
  materials?: Iterable<DesignerMaterialDefinition>
  validators?: Record<string, RuleCustomValidator>
}

export interface DesignerRegistry {
  getMaterial: (key: string) => DesignerMaterialDefinition | undefined
  getValidator: (key: string) => RuleCustomValidator | undefined
  listMaterials: () => DesignerMaterialDefinition[]
  listValidators: () => string[]
  createNode: (key: string, context: DesignerCreateNodeContext) => DesignerNode
}
