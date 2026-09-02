import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { AntdVueOptionSource } from './options'
import type { AntdAutoCompleteValue, AntdSelectValue } from './props'

export interface AntdAutoCompleteFieldEmits {
  'update:value': [value: AntdAutoCompleteValue]
}

export interface AntdCheckboxFieldEmits {
  'update:value': [value: Array<string | number>]
}

export interface AntdChoiceDefaultSetterEmits {
  'update:modelValue': [value: DesignerJsonValue | undefined]
}

export interface AntdOptionSourceSetterEmits {
  'update:modelValue': [value: AntdVueOptionSource | undefined]
}

export interface AntdRadioFieldEmits {
  'update:value': [value: string | number | boolean | undefined]
}

export interface AntdSelectFieldEmits {
  'update:value': [value: AntdSelectValue]
}
