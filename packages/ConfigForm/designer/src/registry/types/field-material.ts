import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import type {
  DesignerDefaultValueKind,
  DesignerFieldMaterialDefinition,
  DesignerPropertySetterDefinition,
  DesignerRuntimeMaterialBinding,
  DesignerSimpleSetterControl,
} from './domain'

export type DesignerFieldMaterialPropertyDefinition = Omit<
  DesignerPropertySetterDefinition,
  | 'component'
  | 'componentProps'
  | 'control'
  | 'key'
  | 'optionSourcePath'
  | 'optionsPath'
  | 'path'
  | 'valueKind'
> & {
  control: DesignerSimpleSetterControl
  default?: ModelJsonValue
}

export interface DesignerFieldMaterialValueDefinition {
  default?: ModelJsonValue
  kind: DesignerDefaultValueKind
  label?: string
}

export type DesignerFieldMaterialOptions = Omit<
  DesignerFieldMaterialDefinition,
  'createNode' | 'kind' | 'runtime' | 'setters' | 'version'
> & {
  component: DesignerRuntimeMaterialBinding['component']
  defaultField?: string
  defaultLabel?: string
  defaultProps?: ModelJsonObject
  props?: Readonly<Record<string, DesignerFieldMaterialPropertyDefinition>>
  runtime?: Omit<DesignerRuntimeMaterialBinding, 'component'>
  setters?: readonly DesignerPropertySetterDefinition[]
  value?: DesignerFieldMaterialValueDefinition
  version?: number
}
