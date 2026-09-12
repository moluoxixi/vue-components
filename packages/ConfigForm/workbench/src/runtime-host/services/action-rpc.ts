import type {
  ConfigFormFlowAction,
  ConfigFormFlowActionContext,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowFormApi,
  ConfigFormJsonValue,
} from '@moluoxixi/config-form-core'
import type {
  RuntimeHostActionCancelMessage,
  RuntimeHostActionContext,
  RuntimeHostActionExecutor,
  RuntimeHostActionIdentity,
  RuntimeHostActionProxyController,
  RuntimeHostActionRequestMessage,
  RuntimeHostActionResultMessage,
  RuntimeHostMessageBase,
  RuntimeHostValuePatch,
} from '../types'
import { createConfigFormFlowFormApi } from '@moluoxixi/config-form-core'
import {
  RUNTIME_HOST_ACTION_DEADLINE_MS,
  RUNTIME_HOST_MAX_PENDING_ACTIONS,
} from '../constants'

type PostActionRequest = (message: Omit<RuntimeHostActionRequestMessage, keyof RuntimeHostMessageBase | 'sequence'>) => void
type PostActionCancel = (message: Omit<RuntimeHostActionCancelMessage, keyof RuntimeHostMessageBase | 'sequence'>) => void

type StrictJsonResult
  = | { success: true, value: ConfigFormJsonValue }
    | { success: false, diagnostic: ConfigFormDiagnostic }

type ConfigFormDiagnostic = ConfigFormFlowDiagnostic

interface RuntimeHostActionProxyOptions {
  getBase: () => RuntimeHostMessageBase
  postRequest: PostActionRequest
  postCancel: PostActionCancel
  isCurrent?: (identity: RuntimeHostActionIdentity) => boolean
  maxPending?: number
  defaultDeadlineMs?: number
}

interface PendingProxyAction {
  context: ConfigFormFlowActionContext
  reject: (reason?: unknown) => void
  resolve: (value: unknown) => void
  request: RuntimeHostActionRequestMessage
  timer?: ReturnType<typeof setTimeout>
  abort?: () => void
}

/** Creates the renderer-side registry. Action functions never cross the iframe boundary. */
export function createRuntimeHostActionProxy(
  options: RuntimeHostActionProxyOptions,
): RuntimeHostActionProxyController {
  const pending = new Map<string, PendingProxyAction>()
  const actions = new Map<string, ConfigFormFlowAction>()
  const maxPending = options.maxPending ?? RUNTIME_HOST_MAX_PENDING_ACTIONS
  const defaultDeadlineMs = options.defaultDeadlineMs ?? RUNTIME_HOST_ACTION_DEADLINE_MS
  let disposed = false
  let requestCounter = 0

  const error = (code: string, message: string, path?: string): Error & { code: string, path?: string } => {
    const value = new Error(message) as Error & { code: string, path?: string }
    value.code = code
    if (path !== undefined)
      value.path = path
    return value
  }

  const requestId = (): string => {
    const random = globalThis.crypto?.randomUUID?.()
    requestCounter += 1
    return `${random ?? 'runtime-action'}:${requestCounter.toString(36)}`
  }

  const identityOf = (base: RuntimeHostMessageBase): RuntimeHostActionIdentity => ({
    hostId: base.hostId,
    pageId: base.pageId,
    projectId: base.projectId,
    revision: base.revision,
  })

  const timeoutFor = (context: ConfigFormFlowActionContext): number => {
    const nodeTimeout = context.node.policy?.timeoutMs
    if (nodeTimeout !== undefined)
      return nodeTimeout
    const flowTimeout = context.flow.errorPolicy?.timeoutMs
    return flowTimeout ?? defaultDeadlineMs
  }

  const settleReject = (id: string, reason: unknown, notifyHost: boolean): void => {
    const entry = pending.get(id)
    if (!entry)
      return
    pending.delete(id)
    if (entry.timer !== undefined)
      clearTimeout(entry.timer)
    if (entry.abort)
      entry.context.signal.removeEventListener('abort', entry.abort)
    if (notifyHost) {
      try {
        const base = options.getBase()
        if (base.hostId === entry.request.hostId
          && base.projectId === entry.request.projectId
          && base.pageId === entry.request.pageId
          && base.revision === entry.request.revision) {
          options.postCancel({ type: 'actionCancel', requestId: id })
        }
      }
      catch {
        // Teardown may invalidate the frame before the cancel can be posted.
      }
    }
    entry.reject(reason)
  }

  const settleResolve = (id: string, value: unknown): void => {
    const entry = pending.get(id)
    if (!entry)
      return
    pending.delete(id)
    if (entry.timer !== undefined)
      clearTimeout(entry.timer)
    if (entry.abort)
      entry.context.signal.removeEventListener('abort', entry.abort)
    entry.resolve(value)
  }

  const execute = (ref: string, input: unknown, context: ConfigFormFlowActionContext): Promise<unknown> => {
    if (disposed)
      return Promise.reject(error('RUNTIME_ACTION_DISPOSED', 'The runtime action bridge is disposed.'))
    if (pending.size >= maxPending)
      return Promise.reject(error('RUNTIME_ACTION_QUEUE_LIMIT', `Runtime action requests cannot exceed ${maxPending} pending calls.`))

    let serializedInput: StrictJsonResult | undefined
    let serializedContext: StrictJsonResult
    try {
      if (input !== undefined)
        serializedInput = strictJson(input, 'input')
      serializedContext = strictJson({
        event: context.event,
        flow: context.flow,
        node: context.node,
        outputs: context.outputs,
        revision: context.revision,
        runId: context.runId,
        values: context.values,
      }, 'context')
    }
    catch (cause) {
      return Promise.reject(cause)
    }
    if (serializedInput && !serializedInput.success)
      return Promise.reject(diagnosticError(serializedInput.diagnostic))
    if (!serializedContext.success)
      return Promise.reject(diagnosticError(serializedContext.diagnostic))
    if (!isJsonRecord(serializedContext.value))
      return Promise.reject(error('RUNTIME_ACTION_CONTEXT_INVALID', 'Runtime action context must be an object.', 'context'))

    const base = options.getBase()
    const identity = identityOf(base)
    if (options.isCurrent && !options.isCurrent(identity))
      return Promise.reject(error('RUNTIME_ACTION_STALE', 'Runtime action belongs to a stale preview revision.'))
    if (context.signal.aborted)
      return Promise.reject(abortReason(context.signal.reason))

    const id = requestId()
    const request: RuntimeHostActionRequestMessage = {
      ...base,
      type: 'actionRequest',
      context: serializedContext.value as unknown as RuntimeHostActionContext,
      ...(serializedInput?.success ? { input: serializedInput.value } : {}),
      ref,
      requestId: id,
    }

    return new Promise<unknown>((resolve, reject) => {
      const entry: PendingProxyAction = { context, reject, resolve, request }
      pending.set(id, entry)
      const abort = (): void => settleReject(id, abortReason(context.signal.reason), true)
      entry.abort = abort
      context.signal.addEventListener('abort', abort, { once: true })
      const timeoutMs = timeoutFor(context)
      if (timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          settleReject(id, error('FLOW_TIMEOUT', 'Runtime action timed out.', 'policy.timeoutMs'), true)
        }, timeoutMs)
      }
      try {
        options.postRequest({
          context: request.context,
          ...(request.input === undefined ? {} : { input: request.input }),
          ref: request.ref,
          requestId: request.requestId,
          type: request.type,
        })
      }
      catch (cause) {
        settleReject(id, cause, false)
      }
    })
  }

  const get = (ref: string): ConfigFormFlowAction | undefined => {
    if (!ref)
      return undefined
    const existing = actions.get(ref)
    if (existing)
      return existing
    const action: ConfigFormFlowAction = {
      execute: (input, context) => execute(ref, input, context),
    }
    actions.set(ref, action)
    return action
  }

  const acceptResult = (message: RuntimeHostActionResultMessage): boolean => {
    const entry = pending.get(message.requestId)
    if (!entry)
      return false
    const requestIdentity = identityOf(entry.request)
    if (message.hostId !== requestIdentity.hostId
      || message.projectId !== requestIdentity.projectId
      || message.pageId !== requestIdentity.pageId
      || message.revision !== requestIdentity.revision) {
      return false
    }
    if (options.isCurrent && !options.isCurrent(requestIdentity)) {
      settleReject(message.requestId, error('RUNTIME_ACTION_STALE', 'Runtime action result belongs to a stale preview revision.'), false)
      return false
    }
    if (!message.success) {
      settleReject(message.requestId, diagnosticError(message.diagnostic), false)
      return true
    }
    if (entry.context.signal.aborted) {
      settleReject(message.requestId, abortReason(entry.context.signal.reason), false)
      return false
    }
    try {
      applyFormPatch(entry.context.form, message.valuePatch!)
    }
    catch (cause) {
      settleReject(message.requestId, cause, false)
      return false
    }
    settleResolve(message.requestId, message.output)
    return true
  }

  const cancelAll = (reason: unknown = error('RUNTIME_ACTION_STALE', 'Runtime action was invalidated.'), notifyHost = true): void => {
    for (const id of [...pending.keys()])
      settleReject(id, reason, notifyHost)
  }

  const dispose = (): void => {
    if (disposed)
      return
    disposed = true
    cancelAll(error('RUNTIME_ACTION_DISPOSED', 'The runtime action bridge is disposed.'), true)
    actions.clear()
  }

  return {
    get pendingCount() { return () => pending.size },
    registry: { get },
    acceptResult,
    cancelAll,
    dispose,
  }
}

interface PendingHostAction {
  controller: AbortController
  message: RuntimeHostActionRequestMessage
  timer?: ReturnType<typeof setTimeout>
  settled: boolean
}

interface RuntimeHostActionExecutorOptions {
  getRegistry: () => ConfigFormFlowActionRegistry | undefined
  isCurrent?: (identity: RuntimeHostActionIdentity) => boolean
  maxPending?: number
  defaultDeadlineMs?: number
  postResult: (message: Omit<RuntimeHostActionResultMessage, keyof RuntimeHostMessageBase | 'sequence'>) => void
}

/** Executes trusted actions in the parent, keeping all form writes in a per-call snapshot. */
export function createRuntimeHostActionExecutor(
  options: RuntimeHostActionExecutorOptions,
): RuntimeHostActionExecutor {
  const pending = new Map<string, PendingHostAction>()
  const maxPending = options.maxPending ?? RUNTIME_HOST_MAX_PENDING_ACTIONS
  const defaultDeadlineMs = options.defaultDeadlineMs ?? RUNTIME_HOST_ACTION_DEADLINE_MS
  let disposed = false

  const diagnostic = (code: string, message: string, path?: string): ConfigFormFlowDiagnostic => ({
    code,
    message,
    ...(path === undefined ? {} : { path }),
  })

  const identityOf = (message: RuntimeHostMessageBase): RuntimeHostActionIdentity => ({
    hostId: message.hostId,
    pageId: message.pageId,
    projectId: message.projectId,
    revision: message.revision,
  })

  const postFailure = (message: RuntimeHostActionRequestMessage, value: ConfigFormFlowDiagnostic): void => {
    if (options.isCurrent && !options.isCurrent(identityOf(message)))
      return
    try {
      options.postResult({
        diagnostic: value,
        requestId: message.requestId,
        success: false,
        type: 'actionResult',
      })
    }
    catch {
      // The frame can disappear during teardown; there is no receiver to notify.
    }
  }

  const finish = (id: string): PendingHostAction | undefined => {
    const entry = pending.get(id)
    if (!entry)
      return undefined
    pending.delete(id)
    entry.settled = true
    if (entry.timer !== undefined)
      clearTimeout(entry.timer)
    return entry
  }

  const execute = async (message: RuntimeHostActionRequestMessage, entry: PendingHostAction): Promise<void> => {
    const registry = options.getRegistry()
    const action = registry?.get(message.ref)
    if (!action) {
      finish(message.requestId)
      postFailure(message, diagnostic('FLOW_ACTION_UNKNOWN', `Unknown flow action: ${message.ref}`, 'ref'))
      return
    }
    if (entry.controller.signal.aborted)
      return

    const snapshot = cloneJsonRecord(message.context.values)
    const before = cloneJsonRecord(snapshot)
    const form = createConfigFormFlowFormApi(snapshot, entry.controller.signal) as ConfigFormFlowFormApi
    // A private extension lets trusted host actions express deletion without
    // exposing a second public form API to the renderer.
    ;(form as typeof form & { deleteValue?: (field: string) => void }).deleteValue = (field: string): void => {
      entry.controller.signal.throwIfAborted()
      delete snapshot[field]
    }
    const context: ConfigFormFlowActionContext = {
      event: message.context.event,
      flow: message.context.flow,
      node: message.context.node,
      outputs: message.context.outputs,
      revision: message.context.revision,
      runId: message.context.runId,
      signal: entry.controller.signal,
      values: message.context.values,
      form,
    }
    try {
      const rawOutput = await action.execute(message.input, context)
      if (entry.settled || entry.controller.signal.aborted)
        return
      const output = rawOutput === undefined ? undefined : strictJson(rawOutput, 'output')
      if (output && !output.success) {
        finish(message.requestId)
        postFailure(message, output.diagnostic)
        return
      }
      const valuePatch = createValuePatch(before, snapshot)
      const current = finish(message.requestId)
      if (!current || (options.isCurrent && !options.isCurrent(identityOf(message))))
        return
      options.postResult({
        ...(output ? { output: output.value } : {}),
        requestId: message.requestId,
        success: true,
        type: 'actionResult',
        valuePatch,
      })
    }
    catch (cause) {
      const current = finish(message.requestId)
      if (!current)
        return
      const value = diagnosticFromCause(cause, entry.controller.signal.aborted
        ? (cause instanceof Error && 'code' in cause && cause.code === 'FLOW_TIMEOUT' ? 'FLOW_TIMEOUT' : 'FLOW_ABORTED')
        : 'FLOW_ACTION_EXECUTION_FAILED')
      postFailure(message, value)
    }
  }

  const handleRequest = (message: RuntimeHostActionRequestMessage): boolean => {
    if (disposed)
      return false
    const identity = identityOf(message)
    if (options.isCurrent && !options.isCurrent(identity))
      return false
    if (pending.has(message.requestId)) {
      postFailure(message, diagnostic('RUNTIME_ACTION_DUPLICATE', 'Runtime action requestId is already pending.', 'requestId'))
      return false
    }
    if (pending.size >= maxPending) {
      postFailure(message, diagnostic('RUNTIME_ACTION_QUEUE_LIMIT', `Runtime action requests cannot exceed ${maxPending} pending calls.`))
      return false
    }
    const controller = new AbortController()
    const entry: PendingHostAction = { controller, message, settled: false }
    pending.set(message.requestId, entry)
    const timeoutMs = message.context.node.policy?.timeoutMs
      ?? message.context.flow.errorPolicy?.timeoutMs
      ?? defaultDeadlineMs
    if (timeoutMs > 0) {
      entry.timer = setTimeout(() => {
        if (!pending.has(message.requestId))
          return
        controller.abort(diagnosticError({ code: 'FLOW_TIMEOUT', message: 'Runtime action timed out.', path: 'policy.timeoutMs' }))
        const current = finish(message.requestId)
        if (current)
          postFailure(message, diagnostic('FLOW_TIMEOUT', 'Runtime action timed out.', 'policy.timeoutMs'))
      }, timeoutMs)
    }
    void execute(message, entry)
    return true
  }

  const handleCancel = (message: RuntimeHostActionCancelMessage): boolean => {
    if (disposed)
      return false
    const entry = pending.get(message.requestId)
    if (!entry)
      return false
    const requestIdentity = identityOf(entry.message)
    if (message.hostId !== requestIdentity.hostId
      || message.projectId !== requestIdentity.projectId
      || message.pageId !== requestIdentity.pageId
      || message.revision !== requestIdentity.revision
      || (options.isCurrent && !options.isCurrent(requestIdentity))) {
      return false
    }
    entry.controller.abort(abortReason('runtime action cancelled'))
    const current = finish(message.requestId)
    if (current)
      postFailure(current.message, diagnostic('FLOW_ABORTED', 'Runtime action was cancelled.', 'signal'))
    return true
  }

  const cancelAll = (reason: unknown = 'runtime action invalidated', notify = false): void => {
    for (const entry of [...pending.values()]) {
      entry.controller.abort(reason)
      const current = finish(entry.message.requestId)
      if (current && notify)
        postFailure(entry.message, diagnostic('FLOW_ABORTED', 'Runtime action was cancelled.', 'signal'))
    }
  }

  const dispose = (): void => {
    if (disposed)
      return
    disposed = true
    cancelAll('runtime action bridge disposed', false)
  }

  return {
    get pendingCount() { return () => pending.size },
    handleCancel,
    handleRequest,
    cancelAll,
    dispose,
  }
}

function strictJson(value: unknown, path: string): StrictJsonResult {
  const ancestors = new Set<object>()
  let entries = 0
  const visit = (current: unknown, currentPath: string, depth: number): StrictJsonResult => {
    if (++entries > 10_000 || depth > 64)
      return { success: false, diagnostic: { code: 'FLOW_STRUCTURE_LIMIT_EXCEEDED', message: 'Runtime action data exceeds the supported size or depth.', path: currentPath } }
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      return { success: true, value: current }
    if (typeof current === 'number') {
      return Number.isFinite(current)
        ? { success: true, value: current }
        : { success: false, diagnostic: { code: 'FLOW_NON_JSON', message: 'Runtime action data numbers must be finite.', path: currentPath } }
    }
    if (typeof current !== 'object')
      return { success: false, diagnostic: { code: 'FLOW_NON_JSON', message: 'Runtime action data must be JSON-safe.', path: currentPath } }
    if (ancestors.has(current))
      return { success: false, diagnostic: { code: 'FLOW_DATA_CIRCULAR', message: 'Runtime action data contains a circular reference.', path: currentPath } }
    if (!Array.isArray(current)
      && Object.getPrototypeOf(current) !== Object.prototype
      && Object.getPrototypeOf(current) !== null) {
      return { success: false, diagnostic: { code: 'FLOW_DATA_OBJECT_UNSUPPORTED', message: 'Runtime action data contains an unsupported object.', path: currentPath } }
    }
    ancestors.add(current)
    try {
      if (Array.isArray(current)) {
        const result: ConfigFormJsonValue[] = []
        for (let index = 0; index < current.length; index += 1) {
          const child = visit(current[index], `${currentPath}.${index}`, depth + 1)
          if (!child.success)
            return child
          result.push(child.value)
        }
        return { success: true, value: result }
      }
      const result: Record<string, ConfigFormJsonValue> = {}
      for (const [key, childValue] of Object.entries(current)) {
        if (key === '__proto__' || key === 'prototype' || key === 'constructor')
          return { success: false, diagnostic: { code: 'FLOW_UNSAFE_KEY', message: `Unsafe runtime action data key: ${key}`, path: `${currentPath}.${key}` } }
        const child = visit(childValue, `${currentPath}.${key}`, depth + 1)
        if (!child.success)
          return child
        Object.defineProperty(result, key, { configurable: true, enumerable: true, value: child.value, writable: true })
      }
      return { success: true, value: result }
    }
    finally {
      ancestors.delete(current)
    }
  }
  return visit(value, path, 0)
}

function isJsonRecord(value: ConfigFormJsonValue): value is Record<string, ConfigFormJsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  const result = strictJson(value, 'values')
  if (!result.success || !isJsonRecord(result.value))
    throw diagnosticError(result.success ? { code: 'FLOW_DATA_INVALID', message: 'Action values must be an object.', path: 'values' } : result.diagnostic)
  return result.value as Record<string, unknown>
}

function createValuePatch(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): RuntimeHostValuePatch {
  const remove = Object.keys(before).filter(key => !Object.hasOwn(after, key))
  const set: Record<string, ConfigFormJsonValue> = {}
  for (const [key, value] of Object.entries(after)) {
    if (!Object.hasOwn(before, key) || !jsonEqual(before[key], value)) {
      const serialized = strictJson(value, `valuePatch.set.${key}`)
      if (!serialized.success)
        throw diagnosticError(serialized.diagnostic)
      set[key] = serialized.value
    }
  }
  return { remove, set }
}

function jsonEqual(left: unknown, right: unknown): boolean {
  const leftResult = strictJson(left, 'left')
  const rightResult = strictJson(right, 'right')
  if (!leftResult.success || !rightResult.success)
    return false
  return canonical(leftResult.value) === canonical(rightResult.value)
}

function canonical(value: ConfigFormJsonValue): string {
  if (Array.isArray(value))
    return `[${value.map(item => canonical(item)).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(',')}}`
  return JSON.stringify(value)
}

function applyFormPatch(
  form: ConfigFormFlowActionContext['form'],
  patch: RuntimeHostValuePatch,
): void {
  const extended = form as typeof form & { deleteValue?: (field: string) => void }
  for (const [field, value] of Object.entries(patch.set))
    form.setValue(field, value)
  for (const field of patch.remove) {
    if (extended.deleteValue)
      extended.deleteValue(field)
    else
      form.setValue(field, undefined)
  }
}

function diagnosticError(diagnostic: ConfigFormFlowDiagnostic | undefined): Error & { code: string, path?: string } {
  const value = new Error(diagnostic?.message ?? 'Runtime action failed.') as Error & { code: string, path?: string }
  value.code = diagnostic?.code ?? 'RUNTIME_ACTION_FAILED'
  if (diagnostic?.path !== undefined)
    value.path = diagnostic.path
  return value
}

function diagnosticFromCause(cause: unknown, fallbackCode: string): ConfigFormFlowDiagnostic {
  const value = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : undefined
  return {
    code: typeof value?.code === 'string' ? value.code : fallbackCode,
    message: cause instanceof Error ? cause.message : String(cause),
    ...(typeof value?.path === 'string' ? { path: value.path } : {}),
  }
}

function abortReason(reason: unknown): Error {
  if (reason instanceof Error)
    return reason
  const value = new Error(reason === undefined ? 'Runtime action aborted.' : String(reason))
  value.name = 'AbortError'
  return value
}
