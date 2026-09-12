import type { ConfigFormFlowStepPolicy } from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface StepPolicyEditorProps {
  disabled?: boolean
  eventArguments: readonly FlowValueOption[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue?: ConfigFormFlowStepPolicy
  outputs: readonly FlowOutputOption[]
}

export interface StepPolicyEditorEmits {
  (event: 'update:modelValue', value: ConfigFormFlowStepPolicy | undefined): void
}
