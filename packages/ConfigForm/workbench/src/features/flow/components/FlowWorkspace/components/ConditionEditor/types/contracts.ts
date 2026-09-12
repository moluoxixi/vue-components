import type { ConfigFormReactionCondition } from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface ConditionEditorProps {
  disabled?: boolean
  eventArguments: readonly FlowValueOption[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue: ConfigFormReactionCondition
  outputs: readonly FlowOutputOption[]
  removable?: boolean
}

export interface ConditionEditorEmits {
  (event: 'update:modelValue', value: ConfigFormReactionCondition): void
  (event: 'remove'): void
}
