import type { ComputedRef } from 'vue'
import type {
  FormErrors,
  FormValues,
  ResolvedBoundNode,
  ResolvedFormNode,
  ValidateTrigger,
} from './contracts'

export interface FormContext {
  values: FormValues
  errors: FormErrors
  inline?: boolean
  labelWidth?: string | number
  getValue: (field: string) => unknown
  getValues: () => FormValues
  isVisible: (field: ResolvedFormNode) => boolean
  isDisabled: (field: ResolvedBoundNode) => boolean
  isReadonly?: (field: ResolvedFormNode) => boolean
  setValue: (field: string, value: unknown) => void
  setValues: (values: FormValues, replace?: boolean) => void
  validateField: (field: string, trigger: ValidateTrigger) => Promise<boolean>
}

export type FieldComponentListeners = Record<string, (...args: unknown[]) => Promise<boolean> | void>

export interface FieldBinding {
  modelValue: ComputedRef<unknown>
  disabled: ComputedRef<boolean>
  attrs: ComputedRef<Record<string, unknown>>
  listeners: ComputedRef<FieldComponentListeners>
}
