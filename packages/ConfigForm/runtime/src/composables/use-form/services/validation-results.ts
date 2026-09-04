import type { UseFormValidationOptions } from '../types'
import type { FieldValidationResult } from '../types/validation'
import type { ValidationResultService } from '../types/validation-internal'

type ResultOptions = Pick<UseFormValidationOptions, 'clearFieldError' | 'errors'>

export function createValidationResultService(
  options: ResultOptions,
): ValidationResultService {
  const latestResultRequestByField = new Map<string, number>()
  let nextResultRequestId = 0

  function reserveResultCommit(fieldNames: readonly string[]): number {
    const requestId = ++nextResultRequestId
    for (const fieldName of fieldNames)
      latestResultRequestByField.set(fieldName, requestId)
    return requestId
  }

  function canCommitResult(fieldName: string, requestId: number): boolean {
    return latestResultRequestByField.get(fieldName) === requestId
  }

  function finishResultCommit(fieldName: string, requestId: number): void {
    if (canCommitResult(fieldName, requestId))
      latestResultRequestByField.delete(fieldName)
  }

  function invalidate(fieldName?: string): void {
    if (fieldName === undefined)
      latestResultRequestByField.clear()
    else
      latestResultRequestByField.delete(fieldName)
  }

  function writeFieldResult(fieldName: string, result: FieldValidationResult): void {
    if (result.errors.length > 0)
      options.errors.value = { ...options.errors.value, [fieldName]: result.errors }
    else
      options.clearFieldError(fieldName)
  }

  function dispose(): void {
    latestResultRequestByField.clear()
  }

  return {
    canCommitResult,
    dispose,
    finishResultCommit,
    invalidate,
    reserveResultCommit,
    writeFieldResult,
  }
}
