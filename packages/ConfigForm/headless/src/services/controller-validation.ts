import type { ConfigFormReactionProjection } from '@moluoxixi/config-form-core'
import type {
  ConfigFormControllerOptions,
  ConfigFormErrors,
  ConfigFormFieldInstance,
  ConfigFormValidateTrigger,
  ConfigFormValidationIssue,
  ConfigFormValues,
} from '../types'
import type {
  ControllerFieldState,
  ControllerFieldStateResolver,
  ControllerValidationResult,
} from '../types/controller-internal'
import { validateConfigFormFieldRuleIssues } from '../schemas'
import { shouldValidateControllerField } from './controller-field-state'
import {
  cloneControllerValue,
  equalControllerValues,
} from './controller-values'

interface CreateControllerValidationServiceOptions<TValues extends ConfigFormValues> {
  getFieldStates: ControllerFieldStateResolver<TValues>
  onErrorsChange?: ConfigFormControllerOptions<TValues>['onErrorsChange']
  onIssuesChange?: ConfigFormControllerOptions<TValues>['onIssuesChange']
  onValidatingChange?: ConfigFormControllerOptions<TValues>['onValidatingChange']
  readValues: () => TValues
}

interface ActiveValidation {
  active: boolean
  controller: AbortController
  instanceKeys: string[]
}

export function createControllerValidationService<TValues extends ConfigFormValues>(
  options: CreateControllerValidationServiceOptions<TValues>,
) {
  let errors: ConfigFormErrors = {}
  let issues: ConfigFormValidationIssue[] = []
  let valuesRevision = 0
  let validationRequestId = 0
  let activeValidationCount = 0
  let disposed = false
  const activeFieldValidationCounts = new Map<string, number>()
  const latestFieldRequest = new Map<string, number>()
  const activeValidations = new Set<ActiveValidation>()

  function getErrors(): ConfigFormErrors {
    return cloneErrors(errors)
  }

  function getIssues(): ConfigFormValidationIssue[] {
    return issues.map(cloneIssue)
  }

  function getInstanceErrors(instanceKey: string): string[] {
    return [...(errors[instanceKey] ?? [])]
  }

  function getValidating(): boolean {
    return activeValidationCount > 0
  }

  function isFieldValidating(instanceKey: string): boolean {
    return (activeFieldValidationCounts.get(instanceKey) ?? 0) > 0
  }

  function commitIssues(nextIssues: readonly ConfigFormValidationIssue[]): void {
    if (disposed)
      return
    const copiedIssues = nextIssues.map(cloneIssue)
    const nextErrors = errorsFromIssues(copiedIssues)
    const issuesChanged = !equalIssues(issues, copiedIssues)
    const errorsChanged = !equalErrors(errors, nextErrors)
    if (!issuesChanged && !errorsChanged)
      return
    issues = copiedIssues
    errors = nextErrors
    if (issuesChanged)
      options.onIssuesChange?.(getIssues())
    if (errorsChanged)
      options.onErrorsChange?.(getErrors())
  }

  function beginValidation(instanceKeys: string[]): ActiveValidation {
    const validation: ActiveValidation = {
      active: true,
      controller: new AbortController(),
      instanceKeys: [...instanceKeys],
    }
    activeValidations.add(validation)
    if (instanceKeys.length === 0)
      return validation

    const wasValidating = getValidating()
    activeValidationCount += instanceKeys.length
    instanceKeys.forEach((instanceKey) => {
      activeFieldValidationCounts.set(
        instanceKey,
        (activeFieldValidationCounts.get(instanceKey) ?? 0) + 1,
      )
    })
    if (!wasValidating)
      options.onValidatingChange?.(true)
    return validation
  }

  function finishValidation(validation: ActiveValidation, publish = true): void {
    if (!validation.active)
      return
    validation.active = false
    activeValidations.delete(validation)
    if (validation.instanceKeys.length === 0)
      return

    validation.instanceKeys.forEach((instanceKey) => {
      const count = (activeFieldValidationCounts.get(instanceKey) ?? 1) - 1
      if (count <= 0)
        activeFieldValidationCounts.delete(instanceKey)
      else
        activeFieldValidationCounts.set(instanceKey, count)
    })
    activeValidationCount = Math.max(0, activeValidationCount - validation.instanceKeys.length)
    if (publish && !disposed && !getValidating())
      options.onValidatingChange?.(false)
  }

  function cancelActive(reason: string, publish = true): void {
    for (const validation of [...activeValidations]) {
      validation.controller.abort(reason)
      finishValidation(validation, publish)
    }
  }

  function invalidate(reason = 'values changed'): void {
    if (disposed)
      return
    valuesRevision += 1
    latestFieldRequest.clear()
    cancelActive(reason)
  }

  async function validateField(
    instanceKey: string,
    trigger: ConfigFormValidateTrigger = 'submit',
    projection?: ConfigFormReactionProjection<TValues>,
  ): Promise<boolean> {
    if (disposed)
      return false
    const values = getValues()
    const states = options.getFieldStates(values, projection)
    const state = states.find(item => item.instanceKey === instanceKey)
    const requestId = ++validationRequestId
    const revision = valuesRevision
    latestFieldRequest.set(instanceKey, requestId)

    if (!state || !shouldValidateControllerField(state, trigger)) {
      clearErrors([instanceKey])
      return true
    }

    const validation = beginValidation([instanceKey])
    try {
      const fieldIssues = await awaitValidation(
        validateState(state, values, validation.controller.signal),
        validation.controller.signal,
      )
      const current = isCurrent(revision, values)
        && latestFieldRequest.get(instanceKey) === requestId
        && !validation.controller.signal.aborted
      if (!current)
        return false

      commitIssues([
        ...issues.filter(issue => issue.instanceKey !== instanceKey),
        ...fieldIssues,
      ])
      return fieldIssues.length === 0
    }
    catch (cause) {
      if (validation.controller.signal.aborted || !isCurrent(revision, values))
        return false
      commitIssues([
        ...issues.filter(issue => issue.instanceKey !== instanceKey),
        createIssue(state, 'validation_exception', validationErrorMessage(cause)),
      ])
      return false
    }
    finally {
      finishValidation(validation)
    }
  }

  async function validateValues(values: TValues): Promise<ControllerValidationResult<TValues>> {
    if (disposed)
      return { issues: [], states: [], status: 'stale' }
    const snapshot = cloneControllerValue(values)
    const states = options.getFieldStates(snapshot)
    const revision = valuesRevision
    const requestId = ++validationRequestId
    const activeStates = states.filter(state => shouldValidateControllerField(state, 'submit'))
    const instanceKeys = states.map(state => state.instanceKey)

    instanceKeys.forEach(instanceKey => latestFieldRequest.set(instanceKey, requestId))
    const validation = beginValidation(activeStates.map(state => state.instanceKey))
    try {
      const results = await awaitValidation(
        Promise.all(activeStates.map(state => validateState(state, snapshot, validation.controller.signal))),
        validation.controller.signal,
      )

      const current = isCurrent(revision, snapshot)
        && !validation.controller.signal.aborted
        && instanceKeys.every(instanceKey => latestFieldRequest.get(instanceKey) === requestId)
      if (!current)
        return { issues: [], states, status: 'stale' }

      const nextIssues = results.flat()
      commitIssues(nextIssues)
      return {
        issues: nextIssues.map(cloneIssue),
        states,
        status: nextIssues.length === 0 ? 'valid' : 'invalid',
      }
    }
    catch (cause) {
      if (validation.controller.signal.aborted || !isCurrent(revision, snapshot))
        return { issues: [], states, status: 'stale' }
      const nextIssues = activeStates.map(state =>
        createIssue(state, 'validation_exception', validationErrorMessage(cause)))
      commitIssues(nextIssues)
      return { issues: nextIssues.map(cloneIssue), states, status: 'invalid' }
    }
    finally {
      finishValidation(validation)
    }
  }

  function clearValidate(instanceKeys?: readonly string[]): void {
    invalidate('validation cleared')
    clearErrors(instanceKeys)
  }

  function clearErrors(instanceKeys?: readonly string[]): void {
    if (disposed)
      return
    if (instanceKeys === undefined) {
      commitIssues([])
      return
    }
    const selected = new Set(instanceKeys)
    commitIssues(issues.filter(issue => !selected.has(issue.instanceKey)))
  }

  function setErrors(nextErrors: ConfigFormErrors): void {
    invalidate('errors replaced')
    const states = options.getFieldStates(getValues())
    const stateByKey = new Map(states.map(state => [state.instanceKey, state]))
    const nextIssues = Object.entries(nextErrors).flatMap(([instanceKey, messages]) => {
      const state = stateByKey.get(instanceKey)
      if (state)
        return messages.map(message => createIssue(state, 'external', message))
      return messages.map(message => ({
        address: { nodeId: instanceKey, scope: [] },
        code: 'external',
        instanceKey,
        message,
        nodeId: instanceKey,
        scope: [],
        valuePath: [instanceKey],
      }))
    })
    commitIssues(nextIssues)
  }

  function reconcileInstances(instances: readonly ConfigFormFieldInstance[]): void {
    const current = new Map(instances.map(instance => [instance.instanceKey, instance]))
    commitIssues(issues.flatMap((issue) => {
      const instance = current.get(issue.instanceKey)
      if (!instance)
        return []
      return [{
        ...issue,
        address: cloneAddress(instance.address),
        nodeId: instance.address.nodeId,
        scope: cloneScope(instance.address.scope),
        valuePath: [...instance.valuePath],
      }]
    }))
  }

  function getValues(): TValues {
    return cloneControllerValue(options.readValues())
  }

  function isCurrent(revision: number, values: TValues): boolean {
    return !disposed
      && valuesRevision === revision
      && equalControllerValues(options.readValues(), values)
  }

  async function validateState(
    state: ControllerFieldState<TValues>,
    values: TValues,
    signal: AbortSignal,
  ): Promise<ConfigFormValidationIssue[]> {
    const validatorValues = cloneControllerValue(values)
    const value = readValue(validatorValues, state.valuePath)
    try {
      const ruleIssues = await validateConfigFormFieldRuleIssues(
        value,
        validatorValues,
        { ...state.field, required: state.required },
        {
          address: cloneAddress(state.address),
          signal,
          valuePath: [...state.valuePath],
        },
      )
      return ruleIssues.map(issue => createIssue(state, issue.code, issue.message))
    }
    catch (cause) {
      if (signal.aborted)
        throw cause
      return [createIssue(state, 'validation_exception', validationErrorMessage(cause))]
    }
  }

  function dispose(): void {
    if (disposed)
      return
    disposed = true
    valuesRevision += 1
    latestFieldRequest.clear()
    cancelActive('controller disposed', false)
    activeValidationCount = 0
    activeFieldValidationCounts.clear()
  }

  return {
    clearErrors,
    clearValidate,
    dispose,
    getErrors,
    getInstanceErrors,
    getIssues,
    getValidating,
    invalidate,
    isFieldValidating,
    reconcileInstances,
    setErrors,
    validateField,
    validateValues,
  }
}

function awaitValidation<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    // Keep observing the original work after cancellation, including late rejections.
    pending.then(
      (result) => {
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      },
      (cause) => {
        signal.removeEventListener('abort', onAbort)
        reject(cause)
      },
    )
    if (signal.aborted)
      onAbort()
  })
}

function createIssue<TValues extends ConfigFormValues>(
  state: ControllerFieldState<TValues>,
  code: string,
  message: string,
): ConfigFormValidationIssue {
  return {
    address: cloneAddress(state.address),
    code,
    instanceKey: state.instanceKey,
    message,
    nodeId: state.address.nodeId,
    scope: cloneScope(state.address.scope),
    valuePath: [...state.valuePath],
  }
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

function errorsFromIssues(issues: readonly ConfigFormValidationIssue[]): ConfigFormErrors {
  const errors: ConfigFormErrors = {}
  issues.forEach((issue) => {
    errors[issue.instanceKey] = [...(errors[issue.instanceKey] ?? []), issue.message]
  })
  return errors
}

function cloneIssue(issue: ConfigFormValidationIssue): ConfigFormValidationIssue {
  return {
    ...issue,
    address: cloneAddress(issue.address),
    scope: cloneScope(issue.scope),
    valuePath: [...issue.valuePath],
  }
}

function cloneAddress(address: ConfigFormValidationIssue['address']): ConfigFormValidationIssue['address'] {
  return { nodeId: address.nodeId, scope: cloneScope(address.scope) }
}

function cloneScope(scope: ConfigFormValidationIssue['scope']): ConfigFormValidationIssue['scope'] {
  return scope.map(entry => ({ rowId: entry.rowId, scopeId: entry.scopeId }))
}

function cloneErrors(value: ConfigFormErrors): ConfigFormErrors {
  return Object.fromEntries(
    Object.entries(value).map(([instanceKey, messages]) => [instanceKey, [...messages]]),
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

function equalIssues(
  left: readonly ConfigFormValidationIssue[],
  right: readonly ConfigFormValidationIssue[],
): boolean {
  return left.length === right.length && left.every((issue, index) => {
    const next = right[index]
    return next !== undefined
      && issue.instanceKey === next.instanceKey
      && issue.code === next.code
      && issue.message === next.message
      && equalPath(issue.valuePath, next.valuePath)
      && equalScope(issue.scope, next.scope)
  })
}

function equalPath(
  left: readonly (number | string)[],
  right: readonly (number | string)[],
): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function equalScope(
  left: ConfigFormValidationIssue['scope'],
  right: ConfigFormValidationIssue['scope'],
): boolean {
  return left.length === right.length && left.every((entry, index) =>
    entry.scopeId === right[index]?.scopeId && entry.rowId === right[index]?.rowId)
}

function validationErrorMessage(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : 'Validation failed.'
}
