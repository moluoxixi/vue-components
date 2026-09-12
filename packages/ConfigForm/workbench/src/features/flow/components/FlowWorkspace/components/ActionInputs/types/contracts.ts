import type {
  ConfigFormFlowActionDescriptor,
  ConfigFormValueInput,
} from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type { FlowCatalogOption } from '../../../../../types'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface ActionInputsProps {
  dataSources?: readonly FlowCatalogOption[]
  descriptor: ConfigFormFlowActionDescriptor
  disabled?: boolean
  eventArguments: readonly FlowValueOption[]
  invalidParameters?: readonly string[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue?: ConfigFormValueInput
  outputs: readonly FlowOutputOption[]
  variables?: readonly FlowCatalogOption[]
}

export interface ActionInputsEmits {
  (event: 'update:modelValue', value: ConfigFormValueInput): void
}
