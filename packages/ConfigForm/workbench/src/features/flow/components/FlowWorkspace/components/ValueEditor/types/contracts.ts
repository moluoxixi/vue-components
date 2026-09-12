import type {
  ConfigFormFlowActionParameterControl,
  ConfigFormFlowActionParameterOption,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type { FlowCatalogOption } from '../../../../../types'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface ValueEditorProps {
  allowReferences?: boolean
  control?: ConfigFormFlowActionParameterControl
  dataSources?: readonly FlowCatalogOption[]
  disabled?: boolean
  invalid?: boolean
  eventArguments: readonly FlowValueOption[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue?: ConfigFormValueInput
  options?: readonly ConfigFormFlowActionParameterOption[]
  outputs: readonly FlowOutputOption[]
  required?: boolean
  variables?: readonly FlowCatalogOption[]
}

export interface ValueEditorEmits {
  (event: 'update:modelValue', value: ConfigFormValueInput): void
}
