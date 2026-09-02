import type { DesignerJsonValue } from '@moluoxixi/config-form-designer'
import type { ElementPlusOptionSource } from './options'
import type { ElementSelectValue } from './props'

export interface ElementCheckboxFieldEmits {
  'update:modelValue': [value: Array<string | number>]
}

export interface ElementChoiceDefaultSetterEmits {
  'update:modelValue': [value: DesignerJsonValue | undefined]
}

export interface ElementOptionSourceSetterEmits {
  'update:modelValue': [value: ElementPlusOptionSource | undefined]
}

export interface ElementRadioFieldEmits {
  'update:modelValue': [value: string | number | boolean | undefined]
}

export interface ElementSelectFieldEmits {
  'update:modelValue': [value: ElementSelectValue]
}
