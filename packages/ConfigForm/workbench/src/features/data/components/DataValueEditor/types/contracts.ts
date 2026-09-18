import type {
  ConfigFormJsonValue,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'

export type DataValueControl = 'value' | 'text' | 'number' | 'boolean' | 'object' | 'array' | 'enum' | 'field' | 'variable' | 'dataSource'

export interface DataCatalogOption {
  value: string
  label: string
}

export interface DataReferenceField {
  nodeId: string
  field: string
  label: string
}

export interface DataValueOption extends DataCatalogOption {
  path?: readonly string[]
}

export interface DataEnumOption {
  title: string
  value: ConfigFormJsonValue
}

export interface DataValueEditorProps {
  allowReferences?: boolean
  control?: DataValueControl
  contextValues?: readonly DataValueOption[]
  dataSources?: readonly DataCatalogOption[]
  disabled?: boolean
  invalid?: boolean
  fields: readonly DataReferenceField[]
  locale: DesignerLocale
  modelValue?: ConfigFormValueInput
  options?: readonly DataEnumOption[]
  required?: boolean
  variables?: readonly DataCatalogOption[]
}

export interface DataValueEditorEmits {
  (event: 'update:modelValue', value: ConfigFormValueInput): void
}
