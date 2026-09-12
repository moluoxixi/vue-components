import type { ConfigFormDataSourceHost, ConfigFormFlowHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { RuntimeHostActionIdentity } from '../types/action-rpc'
import type {
  RuntimeHostDataDiagnostic,
  RuntimeHostDataExecutor,
  RuntimeHostDataExecutorOptions,
  RuntimeHostDataProxy,
  RuntimeHostDataProxyOptions,
  RuntimeHostDataRequestMessage,
} from '../types/data-rpc'
import { RUNTIME_HOST_DATA_DEADLINE_MS, RUNTIME_HOST_MAX_PENDING_DATA_REQUESTS } from '../constants'
import { isRuntimeHostDataInput, isRuntimeHostDataOutput } from '../schemas/data-rpc'
import { isParentToRuntimeHostMessage, isRuntimeHostToParentMessage } from '../schemas/protocol'

function sameIdentity(left: RuntimeHostActionIdentity, right: RuntimeHostActionIdentity): boolean {
  return left.hostId === right.hostId && left.projectId === right.projectId
    && left.pageId === right.pageId && left.revision === right.revision
}

function dataError(code: string, message: string, path?: string): Error & RuntimeHostDataDiagnostic {
  return Object.assign(new Error(message), { code, ...(path === undefined ? {} : { path }) })
}

function diagnosticFromCause(cause: unknown): RuntimeHostDataDiagnostic {
  const read = (key: string): unknown => {
    try {
      return typeof cause === 'object' && cause !== null ? Object.getOwnPropertyDescriptor(cause, key)?.value : undefined
    }
    catch {
      return undefined
    }
  }
  const code = read('code')
  const message = read('message')
  const path = read('path')
  return {
    code: typeof code === 'string' && code ? code.slice(0, 256) : 'RUNTIME_DATA_REQUEST_FAILED',
    message: typeof message === 'string' && message
      ? message.slice(0, 4096)
      : typeof cause === 'string' && cause ? cause.slice(0, 4096) : 'Runtime data request failed.',
    ...(typeof path === 'string' ? { path: path.slice(0, 2048) } : {}),
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function limit(value: number | undefined, fallback: number, maximum: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? Math.min(value, maximum) : fallback
}

interface PendingProxyRequest {
  request: RuntimeHostDataRequestMessage
  signal: AbortSignal
  abort: () => void
  timer: ReturnType<typeof setTimeout>
  resolve: (value: ConfigFormFlowHttpRequestOutput) => void
  reject: (reason: unknown) => void
}

/** Request-only capability. The renderer owns resolution, mapping, caching and form transactions. */
export function createRuntimeHostDataProxy(options: RuntimeHostDataProxyOptions): RuntimeHostDataProxy {
  const pending = new Map<string, PendingProxyRequest>()
  const maxPending = limit(options.maxPending, RUNTIME_HOST_MAX_PENDING_DATA_REQUESTS, RUNTIME_HOST_MAX_PENDING_DATA_REQUESTS)
  const deadline = limit(options.defaultDeadlineMs, RUNTIME_HOST_DATA_DEADLINE_MS, 2_147_483_647)
  let disposed = false
  let counter = 0

  const take = (id: string): PendingProxyRequest | undefined => {
    const entry = pending.get(id)
    if (entry) {
      pending.delete(id)
      clearTimeout(entry.timer)
      entry.signal.removeEventListener('abort', entry.abort)
    }
    return entry
  }
  const reject = (id: string, cause: unknown, notify: boolean): void => {
    const entry = take(id)
    if (!entry)
      return
    if (notify) {
      try {
        if (sameIdentity(options.getBase(), entry.request))
          options.postCancel({ type: 'dataCancel', requestId: id })
      }
      catch {
        // The receiver may already be gone during teardown.
      }
    }
    entry.reject(cause)
  }
  const host: ConfigFormDataSourceHost = {
    request: async (input, signal) => {
      if (disposed)
        throw dataError('RUNTIME_DATA_DISPOSED', 'Runtime data bridge is disposed.')
      if (signal.aborted)
        throw dataError('RUNTIME_DATA_ABORTED', 'Runtime data request was aborted.', 'signal')
      if (!isRuntimeHostDataInput(input))
        throw dataError('RUNTIME_DATA_INPUT_INVALID', 'Runtime data request input must be bounded HTTP request JSON.', 'input')
      const base = options.getBase()
      if (!options.isCurrent(base))
        throw dataError('RUNTIME_DATA_STALE', 'Runtime data request belongs to a stale preview.')
      if (pending.size >= maxPending)
        throw dataError('RUNTIME_DATA_QUEUE_LIMIT', `Runtime data requests cannot exceed ${maxPending} pending calls.`)
      const requestId = `${globalThis.crypto?.randomUUID?.() ?? 'runtime-data'}:${++counter}`
      const request: RuntimeHostDataRequestMessage = { ...base, type: 'dataRequest', requestId, input: cloneJson(input) }
      if (!isRuntimeHostToParentMessage(request))
        throw dataError('RUNTIME_DATA_INPUT_INVALID', 'Runtime data request exceeds the message budget.', 'input')
      return new Promise<ConfigFormFlowHttpRequestOutput>((resolve, rejectPromise) => {
        const abort = (): void => reject(requestId, dataError('RUNTIME_DATA_ABORTED', 'Runtime data request was aborted.', 'signal'), true)
        const timer = setTimeout(() => reject(requestId, dataError('RUNTIME_DATA_TIMEOUT', 'Runtime data request timed out.', 'request'), true), deadline)
        pending.set(requestId, { request, signal, abort, timer, resolve, reject: rejectPromise })
        signal.addEventListener('abort', abort, { once: true })
        try {
          options.postRequest({ type: 'dataRequest', requestId, input: request.input })
        }
        catch (cause) {
          reject(requestId, cause, true)
        }
      })
    },
  }
  const cancelAll = (reason: unknown = dataError('RUNTIME_DATA_STALE', 'Runtime data requests were invalidated.'), notify = true): void => {
    for (const id of [...pending.keys()])
      reject(id, reason, notify)
  }
  return {
    getDataSourceHost: () => host,
    pendingCount: () => pending.size,
    acceptResult: (message) => {
      if (!isParentToRuntimeHostMessage(message) || message.type !== 'dataResult')
        return false
      const entry = pending.get(message.requestId)
      if (!entry || !sameIdentity(message, entry.request))
        return false
      if (!options.isCurrent(entry.request) || entry.signal.aborted) {
        reject(message.requestId, dataError('RUNTIME_DATA_STALE', 'Runtime data result belongs to a stale preview.'), false)
        return false
      }
      take(message.requestId)
      if (message.success)
        entry.resolve(cloneJson(message.output))
      else
        entry.reject(dataError(message.diagnostic.code, message.diagnostic.message, message.diagnostic.path))
      return true
    },
    cancelAll,
    dispose: () => {
      disposed = true
      cancelAll(dataError('RUNTIME_DATA_DISPOSED', 'Runtime data bridge is disposed.'))
    },
  }
}

interface PendingHostRequest {
  message: RuntimeHostDataRequestMessage
  controller: AbortController
  timer: ReturnType<typeof setTimeout>
}

/** The parent never resolves ValueInputs or owns data-source state. */
export function createRuntimeHostDataExecutor(options: RuntimeHostDataExecutorOptions): RuntimeHostDataExecutor {
  const pending = new Map<string, PendingHostRequest>()
  const seen = new Set<string>()
  const maxPending = limit(options.maxPending, RUNTIME_HOST_MAX_PENDING_DATA_REQUESTS, RUNTIME_HOST_MAX_PENDING_DATA_REQUESTS)
  const deadline = limit(options.defaultDeadlineMs, RUNTIME_HOST_DATA_DEADLINE_MS, 2_147_483_647)
  let lastSequence = -1
  let disposed = false

  const take = (id: string): PendingHostRequest | undefined => {
    const entry = pending.get(id)
    if (entry) {
      pending.delete(id)
      clearTimeout(entry.timer)
    }
    return entry
  }
  const failure = (message: RuntimeHostDataRequestMessage, cause: unknown): void => {
    if (!options.isCurrent(message) || disposed)
      return
    try {
      options.postResult({ type: 'dataResult', requestId: message.requestId, success: false, diagnostic: diagnosticFromCause(cause) })
    }
    catch {
      // No receiver remains when the frame has been removed.
    }
  }
  const execute = async (entry: PendingHostRequest): Promise<void> => {
    const { message, controller } = entry
    try {
      const host = options.getHost()
      if (typeof host?.request !== 'function')
        throw dataError('RUNTIME_DATA_HOST_UNAVAILABLE', 'Data requests require an explicit host request capability.', 'dataSourceHost.request')
      if (controller.signal.aborted || !options.isCurrent(message))
        return
      const output = await host.request(cloneJson(message.input), controller.signal)
      if (pending.get(message.requestId) !== entry || controller.signal.aborted || !options.isCurrent(message))
        return
      if (!isRuntimeHostDataOutput(output))
        throw dataError('RUNTIME_DATA_OUTPUT_INVALID', 'Runtime data response must be bounded HTTP response JSON.', 'output')
      const { input: _input, ...envelope } = message
      if (!isParentToRuntimeHostMessage({ ...envelope, type: 'dataResult', success: true, output }))
        throw dataError('RUNTIME_DATA_OUTPUT_INVALID', 'Runtime data response exceeds the message budget.', 'output')
      take(message.requestId)
      options.postResult({ type: 'dataResult', requestId: message.requestId, success: true, output: cloneJson(output) })
    }
    catch (cause) {
      if (pending.get(message.requestId) === entry) {
        take(message.requestId)
        failure(message, cause)
      }
    }
    finally {
      if (pending.get(message.requestId) === entry)
        take(message.requestId)
    }
  }
  const cancelAll = (reason: unknown = dataError('RUNTIME_DATA_STALE', 'Runtime data requests were invalidated.')): void => {
    for (const [id, entry] of pending) {
      take(id)
      entry.controller.abort(reason)
    }
    seen.clear()
    lastSequence = -1
  }
  return {
    pendingCount: () => pending.size,
    handleRequest: (message) => {
      if (disposed || !isRuntimeHostToParentMessage(message) || message.type !== 'dataRequest' || !options.isCurrent(message))
        return false
      // Duplicate delivery must not reject or replace the original live request.
      if (seen.has(message.requestId) || message.sequence <= lastSequence)
        return false
      lastSequence = message.sequence
      if (seen.size >= 10_000) {
        failure(message, dataError('RUNTIME_DATA_REQUEST_LIMIT', 'Runtime data request history is full; reload the preview.'))
        return false
      }
      seen.add(message.requestId)
      if (pending.size >= maxPending) {
        failure(message, dataError('RUNTIME_DATA_QUEUE_LIMIT', `Runtime data requests cannot exceed ${maxPending} pending calls.`))
        return false
      }
      const controller = new AbortController()
      const timer = setTimeout(() => {
        if (take(message.requestId)) {
          const cause = dataError('RUNTIME_DATA_TIMEOUT', 'Runtime data request timed out.', 'request')
          controller.abort(cause)
          failure(message, cause)
        }
      }, deadline)
      const entry = { message: cloneJson(message), controller, timer }
      pending.set(message.requestId, entry)
      void execute(entry)
      return true
    },
    handleCancel: (message) => {
      if (disposed || !isRuntimeHostToParentMessage(message) || message.type !== 'dataCancel')
        return false
      const entry = pending.get(message.requestId)
      if (!entry || !sameIdentity(message, entry.message) || !options.isCurrent(entry.message) || message.sequence <= lastSequence)
        return false
      lastSequence = message.sequence
      take(message.requestId)
      const cause = dataError('RUNTIME_DATA_ABORTED', 'Runtime data request was aborted.', 'signal')
      entry.controller.abort(cause)
      failure(entry.message, cause)
      return true
    },
    cancelAll,
    dispose: () => {
      disposed = true
      cancelAll(dataError('RUNTIME_DATA_DISPOSED', 'Runtime data bridge is disposed.'))
    },
  }
}
