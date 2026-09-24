import type { DesignerDefaultValueKind, DesignerOptionValueType } from '@moluoxixi/config-form-designer'
import type { FieldNode } from '@moluoxixi/config-form-model'
import type {
  AntdVueDesignerOption,
} from './options'

export type AntdAutoCompleteValue = string | number
export type AntdSelectValue = string | number | Array<string | number>

export interface AntdAutoCompleteFieldProps {
  value?: AntdAutoCompleteValue
  options?: AntdVueDesignerOption[]
}

export interface AntdCheckboxFieldProps {
  value?: Array<string | number>
  options?: AntdVueDesignerOption[]
}

export interface AntdChoiceDefaultSetterProps {
  modelValue?: unknown
  disabled?: boolean
  node?: FieldNode
  kind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>
  optionValueTypes: readonly DesignerOptionValueType[]
}

export interface AntdRadioFieldProps {
  value?: string | number | boolean
  options?: AntdVueDesignerOption[]
}

export interface AntdSectionProps {
  title?: string
  description?: string
}

export interface AntdSelectFieldProps {
  value?: AntdSelectValue
  options?: AntdVueDesignerOption[]
}

export type AntdFlexDirection = 'row' | 'column'
export type AntdFlexJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between'
export type AntdFlexAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch'

export interface AntdFlexLayoutProps {
  direction?: AntdFlexDirection
  wrap?: boolean
  gap?: number
  justify?: AntdFlexJustify
  align?: AntdFlexAlign
  itemWidth?: number
}

export interface AntdGridLayoutProps {
  columns?: number
  gap?: number
}
