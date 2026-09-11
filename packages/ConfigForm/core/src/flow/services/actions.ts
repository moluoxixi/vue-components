import type {
  ConfigFormFlowAction,
  ConfigFormFlowActionHost,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowDelayInput,
  ConfigFormFlowHttpRequestInput,
  ConfigFormFlowHttpRequestOutput,
  ConfigFormFlowNavOpenInput,
  ConfigFormFlowUiConfirmInput,
  ConfigFormFlowUiMessageInput,
} from '../types'

export class ConfigFormFlowActionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
  }
}

function requireRecord(input: unknown, action: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires an object input.`)
  return input as Record<string, unknown>
}

function requireText(value: unknown, action: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires a non-empty "${field}" string.`)
  return value
}

function requireHost<T>(capability: T | undefined, action: string, hook: string): T {
  if (!capability)
    throw new ConfigFormFlowActionError('FLOW_ACTION_HOST_MISSING', `${action} needs the "${hook}" host capability.`)
  return capability
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted)
    throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
}

function createHttpRequestAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    execute: async (rawInput, context): Promise<ConfigFormFlowHttpRequestOutput> => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.http.request') as Partial<ConfigFormFlowHttpRequestInput>
      const fetchImpl = requireHost(host.fetch ?? globalThis.fetch?.bind(globalThis), 'builtin.http.request', 'fetch')
      const url = new URL(requireText(input.url, 'builtin.http.request', 'url'), globalThis.location?.href)
      for (const [key, value] of Object.entries(input.query ?? {}))
        url.searchParams.set(key, String(value))
      const method = input.method ?? 'GET'
      const hasBody = input.body !== undefined && method !== 'GET'
      const response = await fetchImpl(url.toString(), {
        method,
        signal: context.signal,
        headers: {
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...input.headers,
        },
        ...(hasBody ? { body: JSON.stringify(input.body) } : {}),
      })
      const data = input.responseType === 'text'
        ? await response.text()
        : await response.json().catch(() => undefined)
      if (!response.ok)
        throw new ConfigFormFlowActionError('FLOW_ACTION_HTTP_STATUS', `builtin.http.request received HTTP ${response.status}.`)
      return { data, ok: response.ok, status: response.status }
    },
  }
}

function createDelayAction(): ConfigFormFlowAction {
  return {
    execute: (rawInput, context) => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.delay') as Partial<ConfigFormFlowDelayInput>
      const ms = Number(input.ms)
      if (!Number.isFinite(ms) || ms < 0)
        throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', 'builtin.delay requires a non-negative "ms" number.')
      return new Promise<{ waitedMs: number }>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        const abort = (): void => {
          clearTimeout(timeout)
          reject(context.signal.reason instanceof Error ? context.signal.reason : new DOMException('Aborted', 'AbortError'))
        }
        timeout = setTimeout(() => {
          context.signal.removeEventListener('abort', abort)
          resolve({ waitedMs: ms })
        }, ms)
        context.signal.addEventListener('abort', abort, { once: true })
      })
    },
  }
}

function createNavOpenAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    execute: (rawInput, context) => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.nav.open') as Partial<ConfigFormFlowNavOpenInput>
      const url = requireText(input.url, 'builtin.nav.open', 'url')
      const openUrl = requireHost(host.openUrl, 'builtin.nav.open', 'openUrl')
      openUrl(url, input.target ?? '_blank')
      return { opened: url }
    },
  }
}

function createUiMessageAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    execute: async (rawInput, context) => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.ui.message') as Partial<ConfigFormFlowUiMessageInput>
      const message = requireText(input.message, 'builtin.ui.message', 'message')
      const notify = requireHost(host.message, 'builtin.ui.message', 'message')
      await notify({ message, type: input.type ?? 'info' })
      return { message }
    },
  }
}

function createUiConfirmAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    execute: async (rawInput, context) => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.ui.confirm') as Partial<ConfigFormFlowUiConfirmInput>
      const message = requireText(input.message, 'builtin.ui.confirm', 'message')
      const confirm = requireHost(host.confirm, 'builtin.ui.confirm', 'confirm')
      const confirmed = await confirm({
        cancelText: input.cancelText,
        confirmText: input.confirmText,
        message,
        title: input.title,
      })
      // Declining is a failure so flows can branch through the error edge or
      // stop, mirroring how form users expect a cancelled confirm to behave.
      if (!confirmed)
        throw new ConfigFormFlowActionError('FLOW_ACTION_CONFIRM_DECLINED', 'builtin.ui.confirm was declined.')
      return { confirmed: true }
    },
  }
}

/**
 * Built-in action library. Hosts inject platform capabilities (fetch, url
 * opening, message/confirm UI); flows reference the actions purely by ref so
 * pages stay serializable.
 */
export function createConfigFormBuiltinFlowActions(
  host: ConfigFormFlowActionHost = {},
): Record<string, ConfigFormFlowAction> {
  return {
    'builtin.delay': createDelayAction(),
    'builtin.http.request': createHttpRequestAction(host),
    'builtin.nav.open': createNavOpenAction(host),
    'builtin.ui.confirm': createUiConfirmAction(host),
    'builtin.ui.message': createUiMessageAction(host),
  }
}

/** Merges action sources into one registry; later sources win on conflicts. */
export function createConfigFormFlowActionRegistry(
  ...sources: Array<Record<string, ConfigFormFlowAction> | ConfigFormFlowActionRegistry>
): ConfigFormFlowActionRegistry {
  return {
    get: (ref) => {
      for (let index = sources.length - 1; index >= 0; index -= 1) {
        const source = sources[index]!
        const action = typeof (source as ConfigFormFlowActionRegistry).get === 'function'
          ? (source as ConfigFormFlowActionRegistry).get(ref)
          : (source as Record<string, ConfigFormFlowAction>)[ref]
        if (action)
          return action
      }
      return undefined
    },
  }
}
