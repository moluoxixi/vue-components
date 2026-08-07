import type { RuleCustomValidator } from '@moluoxixi/zod3-to-rule'
import type { Component } from 'vue'
import type {
  DesignerContainerNode,
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
    | 'options'
    | 'condition'
    | 'validation'
    | 'custom'

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
  component?: Component
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
  getValueFromEvent?: (...args: unknown[]) => unknown
}

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
  createNode: (key: string, context: DesignerCreateNodeContext) => DesignerNode
}
