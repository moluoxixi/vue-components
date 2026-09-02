import type {
  ComponentNodeConfig,
  FieldConfig,
  FormNodeConfig,
  NormalizedFieldConfig,
  NormalizedNodeConfig,
  ResolvedSlotContent,
  SlotContent,
  ValidateTrigger,
} from '../../../types'

export interface FieldDefaultConfig {
  props: Record<string, unknown>
  span: number
  valueProp?: string
  trigger?: string
  blurTrigger?: string
  validateOn?: ValidateTrigger[]
  required?: FieldConfig['required']
  requiredMessage?: FieldConfig['requiredMessage']
  submitWhenHidden?: boolean
  submitWhenDisabled?: boolean
}

export interface BuiltInFieldDefaultsPlugin {
  readonly name: 'config-form:built-in-field-defaults'
  getDefaultField: (field: FormNodeConfig) => FieldDefaultConfig
}

export type DefaultedNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent> = Omit<NormalizedNodeConfig, 'slots'> & {
  slots?: Record<string, TSlot>
  span: number
}

export type DefaultedFieldConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent> = Omit<NormalizedFieldConfig, 'slots'> & {
  slots?: Record<string, TSlot>
}

export type DefaultableFormNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = | (Omit<ComponentNodeConfig, 'slots'> & { slots?: Record<string, TSlot> })
    | (Omit<FieldConfig, 'slots'> & { slots?: Record<string, TSlot> })

export type DefaultedFormNodeConfig<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = DefaultedNodeConfig<TSlot> | DefaultedFieldConfig<TSlot>

export type DefaultedFieldInput<TSlot extends SlotContent | ResolvedSlotContent = SlotContent>
  = DefaultedNodeConfig<TSlot>
    & { field: string }
    & Partial<Pick<
      FieldConfig,
      'blurTrigger' | 'required' | 'requiredMessage' | 'submitWhenDisabled' | 'submitWhenHidden' | 'trigger' | 'validateOn' | 'valueProp'
    >>
