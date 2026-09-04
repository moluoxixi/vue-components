import type { DesignerDefaultValueKind, DesignerJsonValue, DesignerSetterOption } from '@moluoxixi/config-form-designer'
import type { FieldNode } from '@moluoxixi/config-form-model'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from './options'

export type ElementSelectValue
  = | ElementPlusDesignerOption['value']
    | ElementPlusDesignerOption['value'][]
    | null

export interface ElementCheckboxFieldProps {
  modelValue?: Array<string | number>
  options?: ElementPlusDesignerOption[]
  optionSource?: ElementPlusOptionSource
}

export interface ElementChoiceDefaultSetterProps {
  modelValue?: unknown
  disabled?: boolean
  node?: FieldNode
  kind: Extract<DesignerDefaultValueKind, 'select' | 'multiselect'>
}

export interface ElementDefaultValueSetterProps {
  modelValue?: DesignerJsonValue
  disabled?: boolean
  kind: DesignerDefaultValueKind
  options?: DesignerSetterOption[]
}

export interface ElementOptionSourceSetterProps {
  modelValue?: unknown
  disabled?: boolean
}

export interface ElementOptionStateProps {
  state: ElementPlusResolvedOptionState
}

export interface ElementRadioFieldProps {
  modelValue?: string | number | boolean
  options?: ElementPlusDesignerOption[]
  optionSource?: ElementPlusOptionSource
}

export interface ElementSectionProps {
  title?: string
  description?: string
}

export interface ElementSelectFieldProps {
  modelValue?: ElementSelectValue
  options?: ElementPlusDesignerOption[]
  optionSource?: ElementPlusOptionSource
}

export type ElementFlexDirection = 'row' | 'column'
export type ElementFlexJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between'
export type ElementFlexAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch'

export interface ElementFlexLayoutProps {
  direction?: ElementFlexDirection
  wrap?: boolean
  gap?: number
  justify?: ElementFlexJustify
  align?: ElementFlexAlign
  itemWidth?: number
}

export interface ElementGridLayoutProps {
  columns?: number
  gap?: number
}
