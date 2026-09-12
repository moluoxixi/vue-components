import type { ConfigFormReaction } from '@moluoxixi/config-form-core'
import type { DesignerLocale } from '@moluoxixi/config-form-designer'
import type {
  FlowFieldOption,
  FlowOutputOption,
  FlowValueOption,
} from '../../../types'

export interface ReactionEditorProps {
  disabled?: boolean
  eventArguments: readonly FlowValueOption[]
  fields: readonly FlowFieldOption[]
  locale: DesignerLocale
  modelValue: readonly ConfigFormReaction[]
  outputs: readonly FlowOutputOption[]
}

export interface ReactionEditorEmits {
  (event: 'update:modelValue', value: ConfigFormReaction[]): void
}
