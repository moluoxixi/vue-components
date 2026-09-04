import type { FormErrors, ValidateTrigger } from '../../../types'
import type {
  SubmitValidationContext,
  UseFormValidationOptions,
  UseFormValidationResult,
} from '../types'
import type { FieldValidationQueue } from '../types/validation-internal'
import { toRaw } from 'vue'
import { ConfigFormError } from '../../../errors'
import { resolveValue, shouldValidateOn } from '../../../utils'
import { createVisibilitySnapshot, filterErrorsByFieldNames, resolveNodeVisibility } from '../utils/topology'
import { executeFieldValidation, hasFieldValidationRules } from './validation-policy'
import { createFieldValidationQueue } from './validation-queue'
import { createValidationResultService } from './validation-results'
import { createValidationSnapshotService } from './validation-snapshots'

/** 单字段交互校验的节流窗口，避免快速输入时频繁触发 schema 和 validator。 */
export const VALIDATION_THROTTLE_MS = 16

/** 创建单字段与整表校验控制器。 */
export function useFormValidation(options: UseFormValidationOptions): UseFormValidationResult {
  const {
    fields,
    fieldConfigMap,
    nodeTopology,
    values,
    errors,
    clearFieldError,
    getFieldRevision,
    getValueChangesSince,
    getValuesRevision,
    setValueChangeRetention,
    onError,
  } = options

  function createDisposedError(): ConfigFormError {
    return new ConfigFormError(
      'CONFIG_FORM_VALIDATION_DISPOSED',
      'ConfigForm validation was disposed before completion',
    )
  }

  const snapshots = createValidationSnapshotService({
    getValueChangesSince,
    getValuesRevision,
    setValueChangeRetention,
    values,
  })
  const results = createValidationResultService({ clearFieldError, errors })
  let readDisposed = () => false
  const queue: FieldValidationQueue = createFieldValidationQueue({
    createDisposedError,
    executeFieldValidation: (...args) => executeFieldValidation({
      createDisposedError,
      fieldConfigMap,
      getFieldRevision,
      isDisposed: () => readDisposed(),
      nodeTopology,
      values,
    }, ...args),
    getFieldRevision,
    getValuesRevision,
    onDispose: () => {
      results.dispose()
      snapshots.dispose()
    },
    snapshots,
  })
  readDisposed = queue.isDisposed

  async function validateSingleField(
    fieldName: string,
    trigger: ValidateTrigger,
  ): Promise<boolean> {
    if (queue.isDisposed())
      throw createDisposedError()

    const field = fieldConfigMap.value.get(fieldName)
    if (!hasFieldValidationRules(field)) {
      results.invalidate(fieldName)
      clearFieldError(fieldName)
      return true
    }
    if (!shouldValidateOn(field, trigger)) {
      const topology = nodeTopology.value
      const node = topology.fieldNodeMap.get(fieldName)
      const fieldVisible = node ? resolveNodeVisibility(node, values, topology) : true
      if (
        !fieldVisible
        || resolveValue(field.readonly, values, false)
        || resolveValue(field.disabled, values, false)
      ) {
        results.invalidate(fieldName)
        clearFieldError(fieldName)
      }
      return true
    }

    const resultRequestId = results.reserveResultCommit([fieldName])
    try {
      const result = await queue.queueFieldValidation(fieldName, trigger, VALIDATION_THROTTLE_MS)
      if (results.canCommitResult(fieldName, resultRequestId))
        results.writeFieldResult(fieldName, result)
      return result.valid
    }
    finally {
      results.finishResultCommit(fieldName, resultRequestId)
    }
  }

  async function validate(context?: SubmitValidationContext): Promise<boolean> {
    if (queue.isDisposed())
      throw createDisposedError()

    const currentFields = fields.value
    const fieldNames = currentFields.map(field => field.field)
    const resultRequestId = results.reserveResultCommit(fieldNames)
    try {
      let submitContext = context
      if (!submitContext) {
        const valuesSnapshot = { ...toRaw(values) }
        submitContext = {
          valuesSnapshot,
          visibilitySnapshot: createVisibilitySnapshot(valuesSnapshot, nodeTopology.value),
        }
      }

      const validationResults = await Promise.all(
        currentFields.map(field => queue.queueFieldValidation(field.field, 'submit', 0, submitContext)),
      )
      if (queue.isDisposed())
        throw createDisposedError()

      const formErrors: FormErrors = {}
      const nextUiErrors = { ...errors.value }
      let shouldWriteUiErrors = false
      for (const [index, result] of validationResults.entries()) {
        const fieldName = currentFields[index].field
        if (result.errors.length > 0)
          formErrors[fieldName] = result.errors
        if (!results.canCommitResult(fieldName, resultRequestId))
          continue

        shouldWriteUiErrors = true
        if (result.errors.length > 0)
          nextUiErrors[fieldName] = result.errors
        else
          delete nextUiErrors[fieldName]
      }
      if (shouldWriteUiErrors)
        errors.value = filterErrorsByFieldNames(nextUiErrors, fieldNames)
      if (Object.keys(formErrors).length > 0) {
        onError?.(formErrors)
        return false
      }
      return true
    }
    finally {
      for (const fieldName of fieldNames)
        results.finishResultCommit(fieldName, resultRequestId)
    }
  }

  return {
    dispose: queue.dispose,
    invalidate: results.invalidate,
    validate,
    validateSingleField,
  }
}
