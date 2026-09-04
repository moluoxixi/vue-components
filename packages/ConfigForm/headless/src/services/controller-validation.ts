import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ConfigFormControllerOptions,
  ConfigFormErrors,
  ConfigFormFieldSelector,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from '../types'
import type {
  ControllerFieldStateResolver,
  ControllerValidationResult,
} from '../types/controller-internal'
import { validateConfigFormFieldRules } from '../schemas'
import { shouldValidateControllerField } from './controller-field-state'
import {
  normalizeControllerFieldNames,
  shallowEqualControllerValues,
} from './controller-values'

interface CreateControllerValidationServiceOptions<TValues extends ConfigFormValues> {
  getFieldStates: ControllerFieldStateResolver<TValues>
  onErrorsChange?: ConfigFormControllerOptions<TValues>['onErrorsChange']
  onValidatingChange?: ConfigFormControllerOptions<TValues>['onValidatingChange']
  readValues: () => TValues
}

export function createControllerValidationService<TValues extends ConfigFormValues>(
  options: CreateControllerValidationServiceOptions<TValues>,
) {
  let errors: ConfigFormErrors = {}
  let valuesRevision = 0
  let validationRequestId = 0
  let activeValidationCount = 0
  const activeFieldValidationCounts = new Map<string, number>()
  const latestFieldRequest = new Map<string, number>()

  function getErrors(): ConfigFormErrors {
    return cloneErrors(errors)
  }

  function getValidating(): boolean {
    return activeValidationCount > 0
  }

  function isFieldValidating(field: string): boolean {
    return (activeFieldValidationCounts.get(field) ?? 0) > 0
  }

  function commitErrors(nextErrors: ConfigFormErrors): void {
    if (equalErrors(errors, nextErrors))
      return

    errors = cloneErrors(nextErrors)
    options.onErrorsChange?.(getErrors())
  }

  function invalidate(): void {
    valuesRevision += 1
    latestFieldRequest.clear()
  }

  function beginValidation(fieldNames: string[]): void {
    const wasValidating = getValidating()
    activeValidationCount += fieldNames.length
    fieldNames.forEach((field) => {
      activeFieldValidationCounts.set(field, (activeFieldValidationCounts.get(field) ?? 0) + 1)
    })
    if (!wasValidating && getValidating())
      options.onValidatingChange?.(true)
  }

  function finishValidation(fieldNames: string[]): void {
    fieldNames.forEach((field) => {
      const count = (activeFieldValidationCounts.get(field) ?? 1) - 1
      if (count <= 0)
        activeFieldValidationCounts.delete(field)
      else
        activeFieldValidationCounts.set(field, count)
    })
    activeValidationCount = Math.max(0, activeValidationCount - fieldNames.length)
    if (!getValidating())
      options.onValidatingChange?.(false)
  }

  async function validateField(
    fieldName: string,
    trigger: ConfigFormValidateTrigger = 'submit',
    projection?: ConfigFormReactionProjection<TValues>,
  ): Promise<boolean> {
    const values = getValues()
    const states = options.getFieldStates(values, projection)
    const state = states.find(item => item.field.field === fieldName)
    const requestId = ++validationRequestId
    const revision = valuesRevision
    latestFieldRequest.set(fieldName, requestId)

    if (!state || !shouldValidateControllerField(state, trigger)) {
      clearFieldError(fieldName)
      return true
    }

    beginValidation([fieldName])
    try {
      const fieldErrors = await validateConfigFormFieldRules(values[fieldName], values, state.field)
      const current = latestFieldRequest.get(fieldName) === requestId
        && valuesRevision === revision
        && shallowEqualControllerValues(options.readValues(), values)
      if (!current)
        return false

      const nextErrors = { ...errors }
      if (fieldErrors.length > 0)
        nextErrors[fieldName] = fieldErrors
      else
        delete nextErrors[fieldName]
      commitErrors(nextErrors)
      return fieldErrors.length === 0
    }
    finally {
      finishValidation([fieldName])
    }
  }

  async function validate(): Promise<boolean> {
    return (await validateValues(getValues())).status === 'valid'
  }

  async function validateValues(values: TValues): Promise<ControllerValidationResult<TValues>> {
    const states = options.getFieldStates(values)
    const revision = valuesRevision
    const requestId = ++validationRequestId
    const activeStates = states.filter(state => shouldValidateControllerField(state, 'submit'))
    const fieldNames = states.map(state => state.field.field)

    fieldNames.forEach(field => latestFieldRequest.set(field, requestId))
    beginValidation(activeStates.map(state => state.field.field))
    try {
      const results = await Promise.all(activeStates.map(async (state): Promise<[string, string[]]> => [
        state.field.field,
        await validateConfigFormFieldRules(
          values[state.field.field],
          values,
          state.field,
        ),
      ]))

      const current = valuesRevision === revision
        && fieldNames.every(field => latestFieldRequest.get(field) === requestId)
        && shallowEqualControllerValues(options.readValues(), values)
      if (!current)
        return { states, status: 'stale' }

      const nextErrors: ConfigFormErrors = {}
      results.forEach(([field, fieldErrors]) => {
        if (fieldErrors.length > 0)
          nextErrors[field] = fieldErrors
      })
      commitErrors(nextErrors)
      return {
        states,
        status: Object.keys(nextErrors).length === 0 ? 'valid' : 'invalid',
      }
    }
    finally {
      finishValidation(activeStates.map(state => state.field.field))
    }
  }

  function clearValidate(fields?: ConfigFormFieldSelector<TValues>): void {
    invalidate()
    clearErrors(normalizeControllerFieldNames(fields))
  }

  function clearErrors(fieldNames?: string[]): void {
    if (fieldNames === undefined) {
      commitErrors({})
      return
    }

    const nextErrors = { ...errors }
    fieldNames.forEach(field => delete nextErrors[field])
    commitErrors(nextErrors)
  }

  function setErrors(nextErrors: ConfigFormErrors): void {
    invalidate()
    commitErrors(nextErrors)
  }

  function clearFieldError(field: string): void {
    if (!(field in errors))
      return
    const nextErrors = { ...errors }
    delete nextErrors[field]
    commitErrors(nextErrors)
  }

  function getValues(): TValues {
    return { ...options.readValues() }
  }

  return {
    clearFieldError,
    clearErrors,
    clearValidate,
    getErrors,
    getValidating,
    invalidate,
    isFieldValidating,
    setErrors,
    validate,
    validateField,
    validateValues,
  }
}

function cloneErrors(errors: ConfigFormErrors): ConfigFormErrors {
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field, [...messages]]),
  )
}

function equalErrors(left: ConfigFormErrors, right: ConfigFormErrors): boolean {
  const leftFields = Object.keys(left)
  const rightFields = Object.keys(right)
  return leftFields.length === rightFields.length && leftFields.every((field) => {
    const leftMessages = left[field]
    const rightMessages = right[field]
    return rightMessages !== undefined
      && leftMessages.length === rightMessages.length
      && leftMessages.every((message, index) => message === rightMessages[index])
  })
}
