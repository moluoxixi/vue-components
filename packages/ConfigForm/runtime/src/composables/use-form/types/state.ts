import type { Reactive, Ref } from 'vue'
import type { FormErrors, FormValues, NormalizedFieldConfig } from '../../../types'

export interface UseFormStateOptions<T extends object = FormValues> {
  fields: Ref<readonly Pick<NormalizedFieldConfig, 'defaultValue' | 'field'>[]>
  defaultValues?: Partial<T> | Ref<Partial<T> | undefined>
}

export interface FormValueChange {
  fieldName: string
  present: boolean
  requiresFullSnapshot: boolean
  revision: number
  value: unknown
}

export interface UseFormStateResult<T extends object = FormValues> {
  values: Reactive<T & FormValues>
  errors: Ref<FormErrors>
  getFieldRevision: (fieldName: string) => number
  getValueChangesSince: (revision: number) => FormValueChange[] | undefined
  getValuesRevision: () => number
  setValueChangeRetention: (revision: number | undefined) => void
  initValues: (source?: FormValues, pruneToFields?: boolean) => void
  syncErrorsToFields: () => void
  clearFieldError: (fieldName?: string) => void
  setValue: {
    <K extends keyof T & string>(field: K, value: T[K]): void
    (field: string, value: unknown): void
  }
  setValues: (nextValues: Partial<T>, replace?: boolean) => void
  getValue: {
    <K extends keyof T & string>(field: K): T[K]
    (field: string): unknown
  }
  getValues: () => T & FormValues
  reset: () => void
}
