import type { ConfigFormValues } from '../types'
import type { ControllerSubmitServiceOptions } from '../types/controller-internal'
import { isControllerFieldSubmittable } from './controller-field-state'
import { cloneControllerValue, equalControllerValues } from './controller-values'

export function createControllerSubmitService<TValues extends ConfigFormValues>(
  options: ControllerSubmitServiceOptions<TValues>,
): () => Promise<boolean> {
  let submitting = false

  return async (): Promise<boolean> => {
    if (submitting || !options.isActive())
      return false
    submitting = true
    const token = options.getOperationToken()
    const isCurrent = () => options.isOperationCurrent(token)
    try {
      if (options.hasLifecycle('form.beforeSubmit') && !await options.runLifecycle('form.beforeSubmit'))
        return false
      if (!isCurrent())
        return false

      const values = options.getValues()
      const touchedInstanceKeys = options.getFieldStates(values)
        .filter(state => state.visible && !state.disabled && !state.readonly)
        .map(state => state.instanceKey)
      if (!isCurrent())
        return false
      if (touchedInstanceKeys.length > 0)
        options.setTouched(touchedInstanceKeys)
      if (!isCurrent())
        return false

      const result = await options.validateValues(values)
      const isValidated = () => equalControllerValues(options.readValues(), values) && isCurrent()
      if (result.status === 'stale' || !isValidated())
        return false
      if (result.status === 'invalid') {
        const errors = options.getErrors()
        if (options.hasLifecycle('form.validationFailure') && !await options.runLifecycle('form.validationFailure', { errors, values }))
          return false
        if (!isValidated())
          return false
        try {
          options.onError?.(cloneErrors(errors))
        }
        catch (cause) {
          if (isCurrent())
            reportSubmitError(options, cause)
        }
        return false
      }

      if (options.hasLifecycle('form.validationSuccess') && !await options.runLifecycle('form.validationSuccess', { values }))
        return false
      if (!isValidated())
        return false

      const submittedValues = createSubmittedValues(result.states, values, options.scoped)
      if (!isValidated())
        return false
      if (options.hasLifecycle('form.submit') && !await options.runLifecycle('form.submit', { values: submittedValues }))
        return false
      if (!isValidated())
        return false

      await options.onSubmit?.(cloneControllerValue(submittedValues))
      return isCurrent()
    }
    catch (cause) {
      if (isCurrent())
        reportSubmitError(options, cause)
      return false
    }
    finally {
      submitting = false
    }
  }
}

function createSubmittedValues<TValues extends ConfigFormValues>(
  states: Awaited<ReturnType<ControllerSubmitServiceOptions<TValues>['validateValues']>>['states'],
  values: TValues,
  scoped: boolean,
): TValues {
  const transformValues = cloneControllerValue(values)
  if (!scoped) {
    return Object.fromEntries(
      states
        .filter(isControllerFieldSubmittable)
        .map(state => [
          state.field.field,
          state.field.transform
            ? state.field.transform(readValue(transformValues, state.valuePath), transformValues)
            : readValue(transformValues, state.valuePath),
        ]),
    ) as TValues
  }

  const submittedValues = cloneControllerValue(values)
  states.forEach((state) => {
    if (!isControllerFieldSubmittable(state)) {
      deleteValue(submittedValues, state.valuePath)
      return
    }
    if (state.field.transform) {
      setValue(
        submittedValues,
        state.valuePath,
        state.field.transform(readValue(transformValues, state.valuePath), transformValues),
      )
    }
  })
  return submittedValues
}

function readValue(values: ConfigFormValues, path: readonly (number | string)[]): unknown {
  let current: unknown = values
  for (const segment of path) {
    if (current === null || typeof current !== 'object')
      return undefined
    current = (current as Record<number | string, unknown>)[segment]
  }
  return current
}

function setValue(values: ConfigFormValues, path: readonly (number | string)[], value: unknown): void {
  const parent = resolveParent(values, path)
  const key = path.at(-1)
  if (parent === undefined || key === undefined)
    return
  Object.defineProperty(parent, key, {
    configurable: true,
    enumerable: true,
    value: cloneControllerValue(value),
    writable: true,
  })
}

function deleteValue(values: ConfigFormValues, path: readonly (number | string)[]): void {
  const parent = resolveParent(values, path)
  const key = path.at(-1)
  if (parent !== undefined && key !== undefined)
    delete parent[key]
}

function resolveParent(
  values: ConfigFormValues,
  path: readonly (number | string)[],
): Record<number | string, unknown> | undefined {
  let current: unknown = values
  for (const segment of path.slice(0, -1)) {
    if (current === null || typeof current !== 'object')
      return undefined
    current = (current as Record<number | string, unknown>)[segment]
  }
  return current !== null && typeof current === 'object'
    ? current as Record<number | string, unknown>
    : undefined
}

function cloneErrors(errors: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, [...messages]]))
}

function reportSubmitError<TValues extends ConfigFormValues>(
  options: ControllerSubmitServiceOptions<TValues>,
  cause: unknown,
): void {
  options.reportDiagnostic({
    code: 'CONFIG_FORM_SUBMIT_ERROR',
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  })
}
