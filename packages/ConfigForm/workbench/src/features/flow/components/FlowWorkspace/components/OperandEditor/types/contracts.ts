import type { ConfigFormReactionOperand } from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface OperandEditorProps {
  disabled?: boolean
  eventArguments: readonly FlowValueOption[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue: ConfigFormReactionOperand
  outputs: readonly FlowOutputOption[]
}

export interface OperandEditorEmits {
  (event: 'update:modelValue', value: ConfigFormReactionOperand): void
}
