import type { ComputedRef } from 'vue'
import type { ConfigFormError } from '../../../errors'
import type {
  FormValues,
  NormalizedFieldConfig,
  ValidateTrigger,
} from '../../../types'
import type { NodeTopology, VisibilitySnapshot } from './topology'
import type {
  FieldValidationRequest,
  FieldValidationResult,
  SubmitValidationContext,
} from './validation'

export interface ValidationSnapshotService {
  createValuesSnapshot: () => FormValues
  dispose: () => void
  refreshPendingValuesSnapshot: (request: FieldValidationRequest) => void
  releasePendingSnapshot: (request: FieldValidationRequest, revision?: number) => void
  retainPendingSnapshot: (request: FieldValidationRequest) => void
  supportsIncrementalSnapshot: () => boolean
}

export interface ValidationResultService {
  canCommitResult: (fieldName: string, requestId: number) => boolean
  dispose: () => void
  finishResultCommit: (fieldName: string, requestId: number) => void
  invalidate: (fieldName?: string) => void
  reserveResultCommit: (fieldNames: readonly string[]) => number
  writeFieldResult: (fieldName: string, result: FieldValidationResult) => void
}

export interface FieldValidationQueue {
  dispose: () => void
  isDisposed: () => boolean
  queueFieldValidation: (
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    context?: SubmitValidationContext,
  ) => Promise<FieldValidationResult>
}

export interface CreateFieldValidationQueueOptions {
  createDisposedError: () => ConfigFormError
  executeFieldValidation: (
    fieldName: string,
    trigger: ValidateTrigger,
    valuesSnapshot: FormValues,
    fieldRevision: number,
    visibilitySnapshot?: VisibilitySnapshot,
  ) => Promise<FieldValidationResult>
  getFieldRevision: (fieldName: string) => number
  getValuesRevision: () => number
  onDispose: () => void
  snapshots: ValidationSnapshotService
}

export interface ExecuteFieldValidationOptions {
  createDisposedError: () => ConfigFormError
  fieldConfigMap: ComputedRef<Map<string, NormalizedFieldConfig>>
  getFieldRevision: (fieldName: string) => number
  isDisposed: () => boolean
  nodeTopology: ComputedRef<NodeTopology>
  values: FormValues
}
