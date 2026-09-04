import type { FormValues, ValidateTrigger } from '../../../types'
import type {
  FieldValidationRequest,
  FieldValidationResult,
  FieldValidationState,
  SubmitValidationContext,
} from '../types'
import type {
  CreateFieldValidationQueueOptions,
  FieldValidationQueue,
} from '../types/validation-internal'

/** 复用旧 listener 容器并线性追加新 listener，避免突发请求累计复制数组。 */
export function appendValidationListeners<T>(previous: T[], next: readonly T[]): T[] {
  previous.push(...next)
  return previous
}

export function createFieldValidationQueue(
  options: CreateFieldValidationQueueOptions,
): FieldValidationQueue {
  const validationStates = new Map<string, FieldValidationState>()
  let disposed = false

  function rejectRequest(request: FieldValidationRequest, error: Error): void {
    for (const listener of request.listeners)
      listener.reject(error)
    request.listeners.length = 0
  }

  function getFieldValidationState(fieldName: string): FieldValidationState {
    const existing = validationStates.get(fieldName)
    if (existing)
      return existing

    const state: FieldValidationState = { pending: [], pendingStartIndex: 0, running: false }
    validationStates.set(fieldName, state)
    return state
  }

  function getFirstPendingRequest(state: FieldValidationState): FieldValidationRequest | undefined {
    return state.pending[state.pendingStartIndex]
  }

  function takeFirstPendingRequest(state: FieldValidationState): FieldValidationRequest | undefined {
    const request = getFirstPendingRequest(state)
    if (!request)
      return undefined

    state.pendingStartIndex += 1
    if (state.pendingStartIndex >= state.pending.length) {
      state.pending.length = 0
      state.pendingStartIndex = 0
    }
    else if (state.pendingStartIndex >= 1024 && state.pendingStartIndex * 2 >= state.pending.length) {
      state.pending.splice(0, state.pendingStartIndex)
      state.pendingStartIndex = 0
    }
    return request
  }

  function createFieldValidationRequest(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    resolve: (value: FieldValidationResult) => void,
    reject: (reason?: unknown) => void,
    context?: SubmitValidationContext,
    valuesSnapshot?: FormValues,
    incrementalSnapshot?: boolean,
    valuesRevision?: number,
  ): FieldValidationRequest {
    return {
      delayMs,
      fieldName,
      fieldRevision: options.getFieldRevision(fieldName),
      incrementalSnapshot: context === undefined
        ? (incrementalSnapshot ?? options.snapshots.supportsIncrementalSnapshot())
        : false,
      trigger,
      valuesSnapshot: context?.valuesSnapshot ?? valuesSnapshot ?? options.snapshots.createValuesSnapshot(),
      valuesRevision: valuesRevision ?? options.getValuesRevision(),
      visibilitySnapshot: context?.visibilitySnapshot,
      listeners: [{ reject, resolve }],
    }
  }

  function mergeFieldValidationRequest(
    previous: FieldValidationRequest,
    next: FieldValidationRequest,
  ): FieldValidationRequest {
    next.listeners = appendValidationListeners(previous.listeners, next.listeners)
    return next
  }

  function canMergeFieldValidationRequest(
    previous: FieldValidationRequest,
    trigger: ValidateTrigger,
    context?: SubmitValidationContext,
  ): boolean {
    return trigger !== 'submit'
      && previous.trigger === trigger
      && previous.visibilitySnapshot === undefined
      && context?.visibilitySnapshot === undefined
  }

  async function runFieldValidationRequest(
    fieldName: string,
    request: FieldValidationRequest,
  ): Promise<void> {
    const state = getFieldValidationState(fieldName)
    state.running = true
    state.active = request

    try {
      const result = await options.executeFieldValidation(
        request.fieldName,
        request.trigger,
        request.valuesSnapshot,
        request.fieldRevision,
        request.visibilitySnapshot,
      )
      if (disposed)
        throw options.createDisposedError()
      for (const listener of request.listeners)
        listener.resolve(result)
    }
    catch (error) {
      for (const listener of request.listeners)
        listener.reject(error)
    }
    finally {
      state.active = undefined
      state.running = false
      if (disposed) {
        validationStates.delete(fieldName)
      }
      else if (getFirstPendingRequest(state)) {
        scheduleFieldValidation(fieldName, getFirstPendingRequest(state)?.delayMs ?? 0)
      }
      else if (!state.timer) {
        validationStates.delete(fieldName)
      }
    }
  }

  function scheduleFieldValidation(fieldName: string, delayMs: number): void {
    const state = getFieldValidationState(fieldName)
    if (state.running)
      return

    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = undefined
    }

    if (delayMs <= 0) {
      startPendingFieldValidation(fieldName)
      return
    }

    state.timer = setTimeout(() => {
      state.timer = undefined
      startPendingFieldValidation(fieldName)
    }, delayMs)
  }

  function startPendingFieldValidation(fieldName: string): void {
    const state = getFieldValidationState(fieldName)
    if (state.running)
      return

    const request = takeFirstPendingRequest(state)
    if (!request) {
      if (!state.timer)
        validationStates.delete(fieldName)
      return
    }

    options.snapshots.releasePendingSnapshot(request)
    void runFieldValidationRequest(fieldName, request)
  }

  function queueFieldValidation(
    fieldName: string,
    trigger: ValidateTrigger,
    delayMs: number,
    context?: SubmitValidationContext,
  ): Promise<FieldValidationResult> {
    if (disposed)
      return Promise.reject(options.createDisposedError())

    return new Promise((resolve, reject) => {
      const state = getFieldValidationState(fieldName)
      const previous = state.pending.at(-1)
      if (previous && canMergeFieldValidationRequest(previous, trigger, context)) {
        const previousRevision = previous.valuesRevision
        options.snapshots.refreshPendingValuesSnapshot(previous)
        if (previous.valuesRevision !== previousRevision) {
          options.snapshots.releasePendingSnapshot(previous, previousRevision)
          options.snapshots.retainPendingSnapshot(previous)
        }
        const request = createFieldValidationRequest(
          fieldName,
          trigger,
          delayMs,
          resolve,
          reject,
          context,
          previous.valuesSnapshot,
          previous.incrementalSnapshot,
          previous.valuesRevision,
        )
        state.pending[state.pending.length - 1] = mergeFieldValidationRequest(previous, request)
      }
      else {
        const request = createFieldValidationRequest(fieldName, trigger, delayMs, resolve, reject, context)
        state.pending.push(request)
        options.snapshots.retainPendingSnapshot(request)
      }

      if (!state.running) {
        const nextDelay = delayMs <= 0 ? 0 : (getFirstPendingRequest(state)?.delayMs ?? 0)
        scheduleFieldValidation(fieldName, nextDelay)
      }
    })
  }

  function dispose(): void {
    if (disposed)
      return

    disposed = true
    options.onDispose()
    const error = options.createDisposedError()
    for (const [fieldName, state] of validationStates.entries()) {
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = undefined
      }
      for (let index = state.pendingStartIndex; index < state.pending.length; index += 1)
        rejectRequest(state.pending[index], error)
      if (state.active)
        rejectRequest(state.active, error)
      state.pending.length = 0
      state.pendingStartIndex = 0
      if (!state.running)
        validationStates.delete(fieldName)
    }
  }

  return {
    dispose,
    isDisposed: () => disposed,
    queueFieldValidation,
  }
}
