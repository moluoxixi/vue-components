import type { ConfigFormJsonValue } from '../../json'
import type { ConfigFormValueContext, ConfigFormValueInput } from '../../value-reference'
import type { ConfigFormFlowEvent, ConfigFormFlowFormApi } from '../types'
import { evaluateConfigFormExpression } from '../../expression'
import { ConfigFormValueReferenceError, resolveConfigFormValueInput } from '../../value-reference'
import {
  CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH,
  CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES,
  CONFIG_FORM_FLOW_TRACE_MAX_CHARACTERS,
  CONFIG_FORM_FLOW_TRACE_MAX_DEPTH,
  CONFIG_FORM_FLOW_TRACE_MAX_ENTRIES,
} from '../constants'

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const REFERENCE_KEYS = new Set(['$field', '$event', '$output', '$expression'])
const EVENT_MAX_DEPTH = 32
const EVENT_MAX_ENTRIES = 10_000

export class ConfigFormFlowDataError extends Error {
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

export function snapshotConfigFormEventArgs(args: readonly unknown[]): ConfigFormJsonValue[] {
  const stack = new Set<object>()
  let size = 0
  function visit(value: unknown, depth: number, path: string): ConfigFormJsonValue {
    if (++size > EVENT_MAX_ENTRIES || depth > EVENT_MAX_DEPTH) {
      throw new ConfigFormFlowDataError(
        'FLOW_EVENT_LIMIT_EXCEEDED',
        'Event payload exceeds the supported size or depth.',
        path,
      )
    }
    if (value === undefined || value === null)
      return null
    if (typeof value === 'string' || typeof value === 'boolean')
      return value
    if (typeof value === 'number' && Number.isFinite(value))
      return value
    if (typeof value !== 'object')
      throw new ConfigFormFlowDataError('FLOW_EVENT_NON_JSON', 'Event payload must contain serializable data.', path)
    if (stack.has(value))
      throw new ConfigFormFlowDataError('FLOW_EVENT_CIRCULAR', 'Event payload contains a circular reference.', path)
    if (Object.prototype.toString.call(value) === '[object Date]')
      return (value as Date).toISOString()
    if (typeof Event !== 'undefined' && value instanceof Event) {
      const event = value as Event & Record<string, unknown>
      const target = event.target as unknown as Record<string, unknown> | null
      const data: Record<string, unknown> = { type: event.type, timeStamp: event.timeStamp }
      for (const key of ['key', 'code', 'button', 'buttons', 'clientX', 'clientY', 'ctrlKey', 'shiftKey', 'altKey', 'metaKey']) {
        if (typeof event[key] === 'string' || typeof event[key] === 'number' || typeof event[key] === 'boolean')
          data[key] = event[key]
      }
      if (target) {
        data.target = Object.fromEntries(['value', 'checked', 'name'].flatMap(key =>
          ['string', 'number', 'boolean'].includes(typeof target[key]) ? [[key, target[key]]] : []))
      }
      return visit(data, depth + 1, path)
    }
    if (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')
      throw new ConfigFormFlowDataError('FLOW_EVENT_OBJECT_UNSUPPORTED', 'Event payload contains an unsupported object.', path)
    stack.add(value)
    try {
      if (Array.isArray(value))
        return value.map((item, index) => visit(item, depth + 1, appendPath(path, String(index))))
      return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        assertSafeKey(key, appendPath(path, key), 'FLOW_EVENT_UNSAFE_KEY')
        return [key, visit(item, depth + 1, appendPath(path, key))]
      }))
    }
    finally {
      stack.delete(value)
    }
  }
  return args.map((arg, index) => visit(arg, 0, `args.${index}`))
}

export function cloneConfigFormFlowData<T>(value: T): T {
  const ancestors = new Set<object>()
  let entries = 0
  const clone = (current: unknown, depth: number, path: string): unknown => {
    entries += 1
    if (entries > CONFIG_FORM_FLOW_MAX_STRUCTURE_ENTRIES || depth > CONFIG_FORM_FLOW_MAX_STRUCTURE_DEPTH) {
      throw new ConfigFormFlowDataError(
        'FLOW_STRUCTURE_LIMIT_EXCEEDED',
        'Flow data exceeds the supported size or depth.',
        path,
      )
    }
    if (current === null || current === undefined || typeof current === 'string' || typeof current === 'boolean')
      return current
    if (typeof current === 'number') {
      if (!Number.isFinite(current))
        throw new ConfigFormFlowDataError('FLOW_DATA_NON_FINITE', 'Flow data numbers must be finite.', path)
      return current
    }
    if (typeof current !== 'object')
      throw new ConfigFormFlowDataError('FLOW_DATA_UNSUPPORTED', 'Flow data contains an unsupported value.', path)
    if (current instanceof Date)
      return new Date(current.getTime())
    if (ancestors.has(current))
      throw new ConfigFormFlowDataError('FLOW_DATA_CIRCULAR', 'Flow data contains a circular reference.', path)
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null)
      throw new ConfigFormFlowDataError('FLOW_DATA_OBJECT_UNSUPPORTED', 'Flow data contains an unsupported object.', path)
    ancestors.add(current)
    try {
      if (Array.isArray(current))
        return current.map((item, index) => clone(item, depth + 1, appendPath(path, String(index))))
      const result: Record<string, unknown> = {}
      Object.entries(current).forEach(([key, item]) => {
        assertSafeKey(key, appendPath(path, key))
        defineValue(result, key, clone(item, depth + 1, appendPath(path, key)))
      })
      return result
    }
    finally {
      ancestors.delete(current)
    }
  }
  try {
    return clone(value, 0, '') as T
  }
  catch (cause) {
    if (cause instanceof ConfigFormFlowDataError)
      throw cause
    throw new ConfigFormFlowDataError(
      'FLOW_DATA_UNREADABLE',
      cause instanceof Error ? cause.message : 'Flow data could not be read.',
    )
  }
}

/** Produces a bounded JSON-safe debug snapshot without allowing trace failure to fail a run. */
export function snapshotConfigFormFlowTraceValue(value: unknown): {
  value: ConfigFormJsonValue
  truncated: boolean
} {
  const ancestors = new Set<object>()
  let entries = 0
  let characters = 0
  let truncated = false

  const text = (input: string): string => {
    const remaining = Math.max(0, CONFIG_FORM_FLOW_TRACE_MAX_CHARACTERS - characters)
    if (input.length <= remaining) {
      characters += input.length
      return input
    }
    truncated = true
    characters = CONFIG_FORM_FLOW_TRACE_MAX_CHARACTERS
    return `${input.slice(0, Math.max(0, remaining - 14))}[Truncated]`
  }

  const visit = (current: unknown, depth: number): ConfigFormJsonValue => {
    entries += 1
    if (entries > CONFIG_FORM_FLOW_TRACE_MAX_ENTRIES || depth > CONFIG_FORM_FLOW_TRACE_MAX_DEPTH) {
      truncated = true
      return '[Truncated]'
    }
    if (current === undefined || current === null)
      return null
    if (typeof current === 'string')
      return text(current)
    if (typeof current === 'boolean')
      return current
    if (typeof current === 'number') {
      if (Number.isFinite(current))
        return current
      truncated = true
      return text(String(current))
    }
    if (typeof current !== 'object') {
      truncated = true
      return text(`[Unsupported ${typeof current}]`)
    }
    if (current instanceof Date)
      return text(current.toISOString())
    if (ancestors.has(current)) {
      truncated = true
      return '[Circular]'
    }
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      truncated = true
      return text(`[Unsupported ${current.constructor?.name ?? 'object'}]`)
    }
    ancestors.add(current)
    try {
      if (Array.isArray(current))
        return current.map(item => visit(item, depth + 1))
      const result: Record<string, ConfigFormJsonValue> = {}
      Object.entries(current).forEach(([key, item]) => {
        if (UNSAFE_KEYS.has(key)) {
          truncated = true
          return
        }
        defineValue(result, text(key), visit(item, depth + 1))
      })
      return result
    }
    catch {
      truncated = true
      return '[Unreadable]'
    }
    finally {
      ancestors.delete(current)
    }
  }

  return { value: visit(value, 0), truncated }
}

export function resolveConfigFormFlowInput(
  value: unknown,
  values: Record<string, unknown>,
  outputs: Record<string, unknown>,
  event: ConfigFormFlowEvent,
  rootPath = 'config.input',
  valueContext?: ConfigFormValueContext,
): unknown {
  const referenceContext: ConfigFormValueContext = {
    event,
    fields: valueContext?.fields,
    outputs,
    resolveField: valueContext?.resolveField,
    variables: valueContext?.variables,
  }
  const resolve = (input: unknown, path: string): unknown => {
    if (Array.isArray(input))
      return input.map((item, index) => resolve(item, appendPath(path, String(index))))
    if (!input || typeof input !== 'object')
      return input
    const record = input as Record<string, unknown>
    const keys = Object.keys(record)
    if (keys.includes('$ref')) {
      try {
        return resolveConfigFormValueInput(record as ConfigFormValueInput, referenceContext)
      }
      catch (cause) {
        if (cause instanceof ConfigFormValueReferenceError) {
          throw new ConfigFormFlowDataError(
            cause.code,
            cause.message,
            prefixValuePath(path, cause.path),
          )
        }
        throw cause
      }
    }
    const referenceKeys = keys.filter(key => REFERENCE_KEYS.has(key) || key.startsWith('$'))
    if (referenceKeys.length > 0 && (keys.length !== 1 || !REFERENCE_KEYS.has(keys[0]!))) {
      throw new ConfigFormFlowDataError(
        'FLOW_REFERENCE_INVALID',
        'Flow references must contain exactly one supported reference key.',
        path,
      )
    }
    if (keys.length === 1 && typeof record.$field === 'string') {
      assertSafeIdentifier(record.$field, `${path}.$field`)
      if (!Object.hasOwn(values, record.$field)) {
        throw new ConfigFormFlowDataError(
          'FLOW_FIELD_UNAVAILABLE',
          `Flow field is unavailable: ${record.$field}`,
          `${path}.$field`,
        )
      }
      return cloneConfigFormFlowData(values[record.$field])
    }
    if (keys.length === 1 && typeof record.$output === 'string') {
      assertSafeIdentifier(record.$output, `${path}.$output`)
      if (!Object.hasOwn(outputs, record.$output)) {
        throw new ConfigFormFlowDataError(
          'FLOW_OUTPUT_UNAVAILABLE',
          `Action output is unavailable: ${record.$output}`,
          `${path}.$output`,
        )
      }
      return cloneConfigFormFlowData(outputs[record.$output])
    }
    if (keys.length === 1 && typeof record.$event === 'string') {
      if (!record.$event)
        throw new ConfigFormFlowDataError('FLOW_EVENT_REFERENCE_INVALID', 'Event reference cannot be empty.', `${path}.$event`)
      let current: unknown = event
      for (const key of record.$event.split('.')) {
        assertSafeIdentifier(key, `${path}.$event`)
        if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) {
          throw new ConfigFormFlowDataError(
            'FLOW_EVENT_UNAVAILABLE',
            `Event parameter is unavailable: ${record.$event}`,
            `${path}.$event`,
          )
        }
        current = (current as Record<string, unknown>)[key]
      }
      return cloneConfigFormFlowData(current)
    }
    if (keys.length === 1 && typeof record.$expression === 'string') {
      try {
        return cloneConfigFormFlowData(evaluateConfigFormExpression(
          record.$expression,
          { ...values, $outputs: outputs, $event: event },
        ))
      }
      catch (cause) {
        throw flowDataErrorFromCause(cause, `${path}.$expression`)
      }
    }
    if (referenceKeys.length > 0) {
      throw new ConfigFormFlowDataError(
        'FLOW_REFERENCE_INVALID',
        'Flow reference values must be non-empty strings.',
        path,
      )
    }
    const result: Record<string, unknown> = {}
    Object.entries(record).forEach(([key, child]) => {
      assertSafeKey(key, appendPath(path, key))
      defineValue(result, key, resolve(child, appendPath(path, key)))
    })
    return result
  }
  return resolve(value, rootPath)
}

export function createConfigFormFlowFormApi(values: Record<string, unknown>, signal?: AbortSignal): ConfigFormFlowFormApi {
  const setValue = (field: string, value: unknown): void => {
    signal?.throwIfAborted()
    assertSafeIdentifier(field, `form.${field}`)
    defineValue(values, field, cloneConfigFormFlowData(value))
  }
  return {
    getValue: field => Object.hasOwn(values, field) ? cloneConfigFormFlowData(values[field]) : undefined,
    getValues: () => cloneConfigFormFlowData(values),
    setValue,
    setValues: next => Object.entries(next).forEach(([field, value]) => setValue(field, value)),
  }
}

export function flowDataErrorFromCause(cause: unknown, path?: string): ConfigFormFlowDataError {
  if (cause instanceof ConfigFormFlowDataError)
    return cause.path || !path ? cause : new ConfigFormFlowDataError(cause.code, cause.message, path)
  const record = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : undefined
  return new ConfigFormFlowDataError(
    typeof record?.code === 'string' ? record.code : 'FLOW_NODE_ERROR',
    cause instanceof Error ? cause.message : String(cause),
    typeof record?.path === 'string' ? record.path : path,
  )
}

function assertSafeKey(key: string, path: string, code = 'FLOW_DATA_KEY_INVALID'): void {
  if (UNSAFE_KEYS.has(key)) {
    const message = code === 'FLOW_EVENT_UNSAFE_KEY' ? `Unsafe event payload key: ${key}` : `Invalid flow data key: ${key}`
    throw new ConfigFormFlowDataError(code, message, path)
  }
}

function assertSafeIdentifier(key: string, path: string): void {
  if (!key)
    throw new ConfigFormFlowDataError('FLOW_DATA_KEY_INVALID', 'Flow identifiers cannot be empty.', path)
  assertSafeKey(key, path)
}

function appendPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key
}

function prefixValuePath(prefix: string, path: string): string {
  if (path === '$')
    return prefix
  if (path.startsWith('$.'))
    return `${prefix}${path.slice(1)}`
  if (path.startsWith('$['))
    return `${prefix}${path.slice(1)}`
  return prefix
}

function defineValue(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}
