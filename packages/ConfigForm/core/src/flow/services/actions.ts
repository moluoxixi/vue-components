import type {
  ConfigFormFlowAction,
  ConfigFormFlowActionDescriptor,
  ConfigFormFlowActionHost,
  ConfigFormFlowActionParameterControl,
  ConfigFormFlowActionRegistry,
  ConfigFormFlowBuiltinActionRef,
  ConfigFormFlowDelayInput,
  ConfigFormFlowDiagnostic,
  ConfigFormFlowHttpRequestInput,
  ConfigFormFlowHttpRequestOutput,
  ConfigFormFlowNavOpenInput,
  ConfigFormFlowUiConfirmInput,
  ConfigFormFlowUiMessageInput,
} from '../types'
import {
  CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES,
} from '../constants'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const PARAMETER_CONTROLS = new Set<ConfigFormFlowActionParameterControl>([
  'text',
  'number',
  'boolean',
  'enum',
  'value',
  'field',
  'variable',
  'dataSource',
  'object',
  'array',
])

export class ConfigFormFlowActionError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

const ACTION_DESCRIPTORS: readonly ConfigFormFlowActionDescriptor[] = [
  {
    ref: 'builtin.http.request',
    title: 'HTTP request',
    category: 'data',
    parameters: [
      { name: 'url', title: 'URL', control: 'text', required: true },
      {
        name: 'method',
        title: 'Method',
        control: 'enum',
        defaultValue: 'GET',
        options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ title: value, value })),
      },
      { name: 'headers', title: 'Headers', control: 'object' },
      { name: 'query', title: 'Query', control: 'object' },
      { name: 'body', title: 'Body', control: 'value' },
      {
        name: 'responseType',
        title: 'Response type',
        control: 'enum',
        defaultValue: 'json',
        options: ['json', 'text'].map(value => ({ title: value, value })),
      },
    ],
    outputs: [
      { name: 'status', title: 'Status' },
      { name: 'ok', title: 'Successful' },
      { name: 'data', title: 'Response data' },
    ],
    capabilities: ['fetch'],
  },
  {
    ref: 'builtin.delay',
    title: 'Delay',
    category: 'timing',
    parameters: [{ name: 'ms', title: 'Milliseconds', control: 'number', required: true, defaultValue: 300 }],
    outputs: [{ name: 'waitedMs', title: 'Waited milliseconds' }],
    capabilities: [],
  },
  {
    ref: 'builtin.nav.open',
    title: 'Open link',
    category: 'navigation',
    parameters: [
      { name: 'url', title: 'URL', control: 'text', required: true },
      {
        name: 'target',
        title: 'Target',
        control: 'enum',
        defaultValue: '_blank',
        options: [
          { title: 'New window', value: '_blank' },
          { title: 'Current window', value: '_self' },
        ],
      },
    ],
    outputs: [{ name: 'opened', title: 'Opened URL' }],
    capabilities: ['openUrl'],
  },
  {
    ref: 'builtin.ui.message',
    title: 'Show message',
    category: 'feedback',
    parameters: [
      { name: 'message', title: 'Message', control: 'text', required: true },
      {
        name: 'type',
        title: 'Tone',
        control: 'enum',
        defaultValue: 'info',
        options: ['success', 'warning', 'error', 'info'].map(value => ({ title: value, value })),
      },
    ],
    outputs: [{ name: 'message', title: 'Message' }],
    capabilities: ['message'],
  },
  {
    ref: 'builtin.ui.confirm',
    title: 'Confirm dialog',
    category: 'feedback',
    parameters: [
      { name: 'message', title: 'Message', control: 'text', required: true },
      { name: 'title', title: 'Title', control: 'text' },
      { name: 'confirmText', title: 'Confirm text', control: 'text' },
      { name: 'cancelText', title: 'Cancel text', control: 'text' },
    ],
    outputs: [{ name: 'confirmed', title: 'Confirmed' }],
    capabilities: ['confirm'],
  },
  {
    ref: 'notify',
    title: 'Notify (debug)',
    category: 'feedback',
    parameters: [{ name: 'payload', title: 'Payload', control: 'value' }],
    outputs: [{ name: 'notified', title: 'Notification text' }],
    capabilities: ['notify'],
  },
]

/** Includes the five executable built-ins plus metadata for the host notify action. */
export function listConfigFormBuiltinFlowActionDescriptors(): ConfigFormFlowActionDescriptor[] {
  return ACTION_DESCRIPTORS.map(cloneDescriptor)
}

export function analyzeConfigFormFlowActionDescriptor(
  input: unknown,
  expectedRef?: string,
): ConfigFormFlowDiagnostic[] {
  const diagnostics: ConfigFormFlowDiagnostic[] = []
  if (!isRecord(input)) {
    return [{
      code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
      message: 'Flow action descriptor must be a JSON object.',
      path: 'descriptor',
    }]
  }
  if (!isSafeText(input.ref) || (expectedRef !== undefined && input.ref !== expectedRef)) {
    diagnostics.push({
      code: 'FLOW_ACTION_DESCRIPTOR_REF_INVALID',
      message: expectedRef === undefined
        ? 'Flow action descriptor requires a safe ref.'
        : `Flow action descriptor ref must match ${expectedRef}.`,
      path: 'descriptor.ref',
    })
  }
  for (const key of ['title', 'category'] as const) {
    if (!isSafeText(input[key])) {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
        message: `Flow action descriptor requires a non-empty ${key}.`,
        path: `descriptor.${key}`,
      })
    }
  }
  analyzeDescriptorEntries(input.parameters, 'parameters', diagnostics, true)
  analyzeDescriptorEntries(input.outputs, 'outputs', diagnostics, false)
  if (!Array.isArray(input.capabilities) || input.capabilities.some(item => !isSafeText(item))) {
    diagnostics.push({
      code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
      message: 'Flow action descriptor capabilities must be safe strings.',
      path: 'descriptor.capabilities',
    })
  }
  const json = inspectJsonValue(input)
  if (!json.success) {
    diagnostics.push({
      code: json.code,
      message: json.message,
      path: json.path ? `descriptor.${json.path}` : 'descriptor',
    })
  }
  return diagnostics
}

export function getConfigFormFlowActionDescriptorDiagnostic(
  ref: string,
  action: ConfigFormFlowAction,
  registry?: ConfigFormFlowActionRegistry,
): ConfigFormFlowDiagnostic | undefined {
  let descriptor = action.descriptor
  try {
    descriptor ??= registry?.describe?.(ref)
  }
  catch (cause) {
    return {
      code: getErrorCode(cause, 'FLOW_ACTION_DESCRIPTOR_INVALID'),
      message: cause instanceof Error ? cause.message : 'Flow action descriptor is invalid.',
      path: getErrorPath(cause) ?? 'descriptor',
      severity: 'warning',
    }
  }
  if (!descriptor) {
    return {
      code: 'FLOW_ACTION_DESCRIPTOR_MISSING',
      message: `Flow action ${ref} can execute, but has no authoring descriptor.`,
      path: 'descriptor',
      severity: 'warning',
    }
  }
  const diagnostic = analyzeConfigFormFlowActionDescriptor(descriptor, ref)[0]
  return diagnostic ? { ...diagnostic, severity: 'warning' } : undefined
}

function descriptor(ref: string): ConfigFormFlowActionDescriptor {
  const value = ACTION_DESCRIPTORS.find(item => item.ref === ref)
  if (!value)
    throw new ConfigFormFlowActionError('FLOW_ACTION_DESCRIPTOR_MISSING', `Missing built-in descriptor: ${ref}`)
  return cloneDescriptor(value)
}

function requireRecord(input: unknown, action: string): Record<string, unknown> {
  if (!isRecord(input))
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires an object input.`, 'config.input')
  return input
}

function requireText(value: unknown, action: string, field: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires a non-empty "${field}" string.`, `config.input.${field}`)
  return value
}

function optionalText(value: unknown, action: string, field: string): string | undefined {
  if (value === undefined)
    return undefined
  if (typeof value !== 'string')
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires "${field}" to be a string.`, `config.input.${field}`)
  return value
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  fallback: T[number],
  allowed: T,
  action: string,
  field: string,
): T[number] {
  const candidate = value ?? fallback
  if (typeof candidate !== 'string' || !allowed.includes(candidate)) {
    throw new ConfigFormFlowActionError(
      'FLOW_ACTION_INPUT_INVALID',
      `${action} requires "${field}" to be one of ${allowed.join(', ')}.`,
      `config.input.${field}`,
    )
  }
  return candidate
}

function requireHost<T>(capability: T | undefined, action: string, hook: string): T {
  if (!capability)
    throw new ConfigFormFlowActionError('FLOW_ACTION_HOST_MISSING', `${action} needs the "${hook}" host capability.`, `host.${hook}`)
  return capability
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted)
    throw signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
}

function stringRecord(value: unknown, action: string, field: string): Record<string, string> | undefined {
  if (value === undefined)
    return undefined
  if (!isRecord(value))
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires "${field}" to be an object.`, `config.input.${field}`)
  const result: Record<string, string> = {}
  Object.entries(value).forEach(([key, item]) => {
    assertSafeKey(key, `config.input.${field}.${key}`)
    if (typeof item !== 'string')
      throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires string ${field} values.`, `config.input.${field}.${key}`)
    result[key] = item
  })
  return result
}

function queryRecord(value: unknown, action: string): Record<string, string | number | boolean> | undefined {
  if (value === undefined)
    return undefined
  if (!isRecord(value))
    throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires "query" to be an object.`, 'config.input.query')
  const result: Record<string, string | number | boolean> = {}
  Object.entries(value).forEach(([key, item]) => {
    assertSafeKey(key, `config.input.query.${key}`)
    if (!['string', 'number', 'boolean'].includes(typeof item) || (typeof item === 'number' && !Number.isFinite(item))) {
      throw new ConfigFormFlowActionError(
        'FLOW_ACTION_INPUT_INVALID',
        `${action} query values must be finite numbers, strings, or booleans.`,
        `config.input.query.${key}`,
      )
    }
    result[key] = item as string | number | boolean
  })
  return result
}

function createHttpRequestAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    descriptor: descriptor('builtin.http.request'),
    execute: async (rawInput, context): Promise<ConfigFormFlowHttpRequestOutput> => {
      throwIfAborted(context.signal)
      const action = 'builtin.http.request'
      const input = requireRecord(rawInput, action) as Partial<ConfigFormFlowHttpRequestInput>
      const fetchImpl = requireHost(host.fetch, action, 'fetch')
      const urlText = requireText(input.url, action, 'url')
      let url: URL
      try {
        url = new URL(urlText)
      }
      catch {
        throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', `${action} requires an absolute URL.`, 'config.input.url')
      }
      const query = queryRecord(input.query, action)
      Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)))
      const method = enumValue(input.method, 'GET', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const, action, 'method')
      const responseType = enumValue(input.responseType, 'json', ['json', 'text'] as const, action, 'responseType')
      const headers = stringRecord(input.headers, action, 'headers')
      if (input.body !== undefined) {
        const body = inspectJsonValue(input.body)
        if (!body.success)
          throw new ConfigFormFlowActionError(body.code, body.message, `config.input.body${body.path ? `.${body.path}` : ''}`)
      }
      const hasBody = input.body !== undefined && method !== 'GET'
      const response = await fetchImpl(url.toString(), {
        method,
        signal: context.signal,
        headers: {
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        ...(hasBody ? { body: JSON.stringify(input.body) } : {}),
      })
      const data = responseType === 'text'
        ? await response.text()
        : await response.json().catch(() => undefined)
      if (!response.ok)
        throw new ConfigFormFlowActionError('FLOW_ACTION_HTTP_STATUS', `${action} received HTTP ${response.status}.`, 'response.status')
      return { data, ok: response.ok, status: response.status }
    },
  }
}

function createDelayAction(): ConfigFormFlowAction {
  return {
    descriptor: descriptor('builtin.delay'),
    execute: (rawInput, context) => {
      throwIfAborted(context.signal)
      const input = requireRecord(rawInput, 'builtin.delay') as Partial<ConfigFormFlowDelayInput>
      const ms = input.ms
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0)
        throw new ConfigFormFlowActionError('FLOW_ACTION_INPUT_INVALID', 'builtin.delay requires a non-negative "ms" number.', 'config.input.ms')
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
    descriptor: descriptor('builtin.nav.open'),
    execute: (rawInput, context) => {
      throwIfAborted(context.signal)
      const action = 'builtin.nav.open'
      const input = requireRecord(rawInput, action) as Partial<ConfigFormFlowNavOpenInput>
      const url = requireText(input.url, action, 'url')
      const target = enumValue(input.target, '_blank', ['_blank', '_self'] as const, action, 'target')
      const openUrl = requireHost(host.openUrl, action, 'openUrl')
      openUrl(url, target)
      return { opened: url }
    },
  }
}

function createUiMessageAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    descriptor: descriptor('builtin.ui.message'),
    execute: async (rawInput, context) => {
      throwIfAborted(context.signal)
      const action = 'builtin.ui.message'
      const input = requireRecord(rawInput, action) as Partial<ConfigFormFlowUiMessageInput>
      const message = requireText(input.message, action, 'message')
      const type = enumValue(input.type, 'info', ['success', 'warning', 'error', 'info'] as const, action, 'type')
      const notify = requireHost(host.message, action, 'message')
      await notify({ message, type })
      return { message }
    },
  }
}

function createUiConfirmAction(host: ConfigFormFlowActionHost): ConfigFormFlowAction {
  return {
    descriptor: descriptor('builtin.ui.confirm'),
    execute: async (rawInput, context) => {
      throwIfAborted(context.signal)
      const action = 'builtin.ui.confirm'
      const input = requireRecord(rawInput, action) as Partial<ConfigFormFlowUiConfirmInput>
      const message = requireText(input.message, action, 'message')
      const confirm = requireHost(host.confirm, action, 'confirm')
      const confirmed = await confirm({
        cancelText: optionalText(input.cancelText, action, 'cancelText'),
        confirmText: optionalText(input.confirmText, action, 'confirmText'),
        message,
        title: optionalText(input.title, action, 'title'),
      })
      if (!confirmed)
        throw new ConfigFormFlowActionError('FLOW_ACTION_CONFIRM_DECLINED', `${action} was declined.`)
      return { confirmed: true }
    },
  }
}

/**
 * Built-in action library. Hosts inject platform capabilities; in particular,
 * HTTP never falls back to global fetch.
 */
export function createConfigFormBuiltinFlowActions(
  host: ConfigFormFlowActionHost = {},
): Record<ConfigFormFlowBuiltinActionRef, ConfigFormFlowAction> {
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
): ConfigFormFlowActionRegistry & {
  list: () => readonly ConfigFormFlowActionDescriptor[]
  describe: (ref: string) => ConfigFormFlowActionDescriptor | undefined
} {
  const get = (ref: string): ConfigFormFlowAction | undefined => {
    for (let index = sources.length - 1; index >= 0; index -= 1) {
      const source = sources[index]!
      const action = isRegistry(source) ? source.get(ref) : source[ref]
      if (action)
        return action
    }
    return undefined
  }

  const describe = (ref: string): ConfigFormFlowActionDescriptor | undefined => {
    for (let index = sources.length - 1; index >= 0; index -= 1) {
      const source = sources[index]!
      const action = isRegistry(source) ? source.get(ref) : source[ref]
      if (!action)
        continue
      const value = action.descriptor ?? (isRegistry(source) ? source.describe?.(ref) : undefined)
      if (!value)
        return undefined
      assertDescriptor(value, ref)
      return cloneDescriptor(value)
    }
    return undefined
  }

  const list = (): readonly ConfigFormFlowActionDescriptor[] => {
    const refs = new Set<string>()
    sources.forEach((source) => {
      if (isRegistry(source))
        source.list?.().forEach(item => refs.add(item.ref))
      else
        Object.keys(source).forEach(ref => refs.add(ref))
    })
    return [...refs]
      .sort((left, right) => left.localeCompare(right))
      .flatMap((ref) => {
        const value = describe(ref)
        return value ? [value] : []
      })
  }

  return { get, list, describe }
}

function analyzeDescriptorEntries(
  input: unknown,
  key: 'parameters' | 'outputs',
  diagnostics: ConfigFormFlowDiagnostic[],
  parameters: boolean,
): void {
  if (!Array.isArray(input)) {
    diagnostics.push({
      code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
      message: `Flow action descriptor ${key} must be an array.`,
      path: `descriptor.${key}`,
    })
    return
  }
  const names = new Set<string>()
  input.forEach((entry, index) => {
    const path = `descriptor.${key}.${index}`
    if (!isRecord(entry) || !isSafeText(entry.name) || !isSafeText(entry.title)) {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
        message: `Flow action descriptor ${key} require safe names and titles.`,
        path,
      })
      return
    }
    if (names.has(entry.name)) {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_DUPLICATE',
        message: `Duplicate action descriptor ${key} name: ${entry.name}`,
        path: `${path}.name`,
      })
    }
    names.add(entry.name)
    if (parameters && (typeof entry.control !== 'string' || !PARAMETER_CONTROLS.has(entry.control as ConfigFormFlowActionParameterControl))) {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_CONTROL_INVALID',
        message: `Invalid action parameter control: ${String(entry.control)}`,
        path: `${path}.control`,
      })
    }
    if (parameters && entry.required !== undefined && typeof entry.required !== 'boolean') {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
        message: 'Action parameter required must be a boolean.',
        path: `${path}.required`,
      })
    }
    if (parameters && entry.options !== undefined && !Array.isArray(entry.options)) {
      diagnostics.push({
        code: 'FLOW_ACTION_DESCRIPTOR_INVALID',
        message: 'Action parameter options must be an array.',
        path: `${path}.options`,
      })
    }
  })
}

function assertDescriptor(value: ConfigFormFlowActionDescriptor, ref: string): void {
  const diagnostic = analyzeConfigFormFlowActionDescriptor(value, ref)[0]
  if (diagnostic)
    throw new ConfigFormFlowActionError(diagnostic.code, diagnostic.message, diagnostic.path)
}

function cloneDescriptor(value: ConfigFormFlowActionDescriptor): ConfigFormFlowActionDescriptor {
  return structuredClone(value)
}

function isRegistry(
  source: Record<string, ConfigFormFlowAction> | ConfigFormFlowActionRegistry,
): source is ConfigFormFlowActionRegistry {
  return typeof (source as ConfigFormFlowActionRegistry).get === 'function'
}

function inspectJsonValue(
  value: unknown,
): { success: true } | { success: false, code: string, message: string, path?: string } {
  let entries = 0
  const ancestors = new Set<object>()
  const visit = (current: unknown, depth: number, path: string): ReturnType<typeof inspectJsonValue> => {
    entries += 1
    if (entries > CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES || depth > CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH) {
      return {
        success: false,
        code: 'FLOW_STRUCTURE_LIMIT_EXCEEDED',
        message: 'Flow JSON data exceeds the supported size or depth.',
        path,
      }
    }
    if (current === null || typeof current === 'string' || typeof current === 'boolean')
      return { success: true }
    if (typeof current === 'number') {
      return Number.isFinite(current)
        ? { success: true }
        : { success: false, code: 'FLOW_NON_JSON', message: 'Flow JSON numbers must be finite.', path }
    }
    if (typeof current !== 'object')
      return { success: false, code: 'FLOW_NON_JSON', message: 'Flow data must be JSON-safe.', path }
    if (ancestors.has(current))
      return { success: false, code: 'FLOW_NON_JSON', message: 'Flow data contains a circular reference.', path }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null)
      return { success: false, code: 'FLOW_NON_JSON', message: 'Flow data contains a non-JSON object.', path }
    ancestors.add(current)
    const children = Array.isArray(current)
      ? current.map((item, index) => [String(index), item] as const)
      : Object.entries(current)
    for (const [key, child] of children) {
      if (UNSAFE_KEYS.has(key)) {
        ancestors.delete(current)
        return { success: false, code: 'FLOW_UNSAFE_KEY', message: `Unsafe flow data key: ${key}`, path: path ? `${path}.${key}` : key }
      }
      const result = visit(child, depth + 1, path ? `${path}.${key}` : key)
      if (!result.success) {
        ancestors.delete(current)
        return result
      }
    }
    ancestors.delete(current)
    return { success: true }
  }
  return visit(value, 0, '')
}

function isSafeText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !UNSAFE_KEYS.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSafeKey(key: string, path: string): void {
  if (!key || UNSAFE_KEYS.has(key))
    throw new ConfigFormFlowActionError('FLOW_UNSAFE_KEY', `Unsafe flow data key: ${key}`, path)
}

function getErrorCode(cause: unknown, fallback: string): string {
  return isRecord(cause) && typeof cause.code === 'string' ? cause.code : fallback
}

function getErrorPath(cause: unknown): string | undefined {
  return isRecord(cause) && typeof cause.path === 'string' ? cause.path : undefined
}
