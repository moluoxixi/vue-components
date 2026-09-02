import type { ComputedRef, Ref } from 'vue'
import type { FormErrors, FormValues, NormalizedFieldConfig, ValidateTrigger } from '../../../types'
import type { FormValueChange } from './state'
import type { NodeTopology, VisibilitySnapshot } from './topology'

export interface FieldValidationResult {
  errors: string[]
  valid: boolean
}

export interface FieldValidationRequest {
  delayMs: number
  fieldName: string
  fieldRevision: number
  trigger: ValidateTrigger
  valuesSnapshot: FormValues
  valuesRevision: number
  visibilitySnapshot?: VisibilitySnapshot
  listeners: Array<{
    resolve: (value: FieldValidationResult) => void
    reject: (reason?: unknown) => void
  }>
  incrementalSnapshot: boolean
}

export interface FieldValidationState {
  timer?: ReturnType<typeof setTimeout>
  running: boolean
  pending: FieldValidationRequest[]
  pendingStartIndex: number
  active?: FieldValidationRequest
}

export interface UseFormValidationOptions {
  fields: ComputedRef<NormalizedFieldConfig[]>
  fieldConfigMap: ComputedRef<Map<string, NormalizedFieldConfig>>
  nodeTopology: ComputedRef<NodeTopology>
  values: FormValues
  errors: Ref<FormErrors>
  clearFieldError: (fieldName?: string) => void
  getFieldRevision: (fieldName: string) => number
  getValueChangesSince: (revision: number) => FormValueChange[] | undefined
  getValuesRevision: () => number
  setValueChangeRetention: (revision: number | undefined) => void
  onError?: (errors: FormErrors) => void
}

export interface UseFormValidationResult {
  dispose: () => void
  invalidate: (fieldName?: string) => void
  validate: (context?: SubmitValidationContext) => Promise<boolean>
  validateSingleField: (fieldName: string, trigger: ValidateTrigger) => Promise<boolean>
}

export interface SubmitValidationContext {
  valuesSnapshot: FormValues
  visibilitySnapshot: VisibilitySnapshot
}
