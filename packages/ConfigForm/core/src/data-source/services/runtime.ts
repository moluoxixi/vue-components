import type { ConfigFormJsonValue } from '../../json'
import type {
  ConfigFormValueContext,
  ConfigFormValueInput,
} from '../../value-reference'
import type {
  ConfigFormDataSourceDefinition,
  ConfigFormDataSourceDiagnostic,
  ConfigFormDataSourceHttpRequestInput,
  ConfigFormDataSourceHttpRequestOutput,
  ConfigFormDataSourceLoadOptions,
  ConfigFormDataSourceRequestDefinition,
  ConfigFormDataSourceRuntime,
  ConfigFormDataSourceRuntimeOptions,
  ConfigFormDataSourceState,
} from '../types'
import {
  cloneConfigFormJsonValue,
  getConfigFormJsonSemanticHash,
} from '../../json'
import {
  ConfigFormValueReferenceError,
  remapConfigFormValueReferences,
  resolveConfigFormValueInput,
} from '../../value-reference'

export const CONFIG_FORM_DATA_SOURCE_DEFAULT_TIMEOUT_MS = 10_000
export const CONFIG_FORM_DATA_SOURCE_DEFAULT_MAX_ENTRIES = 100

const MAX_TIMER_MS = 2_147_483_647
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const RESPONSE_TYPES = new Set(['json', 'text'])
const SOURCE_KEYS = new Set([
  'id',
  'name',
  'request',
  'mapping',
  'dependencies',
  'auto',
  'timeoutMs',
  'cacheTtlMs',
])
const REQUEST_KEYS = new Set(['url', 'method', 'headers', 'query', 'body', 'responseType'])

interface NormalizedSource extends ConfigFormDataSourceDefinition {
  readonly definitionPath: string
}

interface CacheEntry {
  readonly dependencyKey: string
  readonly expiresAt: number
  readonly state: ConfigFormDataSourceState
}

interface RuntimeEntry {
  readonly key: string
  readonly sourceId: string
  readonly scopeKey?: string
  state: ConfigFormDataSourceState
  cache?: CacheEntry
  active?: ActiveRun
  generation: number
  accessed: number
}

interface ActiveRun {
  readonly runId: string
  readonly startedAt: number
  readonly generation: number
  readonly controller: AbortController
  readonly cancellation: Promise<never>
  cancel: (error: ConfigFormDataSourceError) => void
  cleanup: () => void
}

export class ConfigFormDataSourceError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string, options?: ErrorOptions) {
    super(message, options)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.path = path
  }
}

/**
 * Creates an explicit, host-driven data-source runtime. Construction never
 * consumes `auto` and never starts a request.
 */
export function createConfigFormDataSourceRuntime(
  options: ConfigFormDataSourceRuntimeOptions,
): ConfigFormDataSourceRuntime {
  const normalizedOptions = validateRuntimeOptions(options)
  const sources = normalizeSources(normalizedOptions.sources)
  const entries = new Map<string, RuntimeEntry>()
  const maxEntries = normalizedOptions.maxEntries ?? CONFIG_FORM_DATA_SOURCE_DEFAULT_MAX_ENTRIES
  let disposed = false
  let runSequence = 0
  let accessSequence = 0

  const touch = (entry: RuntimeEntry): void => {
    accessSequence += 1
    entry.accessed = accessSequence
  }

  const isCurrent = (entry: RuntimeEntry, generation: number): boolean => (
    !disposed
    && entries.get(entry.key) === entry
    && entry.generation === generation
  )

  const notify = (state: ConfigFormDataSourceState): void => {
    if (disposed || !normalizedOptions.onState)
      return
    try {
      normalizedOptions.onState(cloneState(state))
    }
    catch {
      // Observers cannot change request or cache semantics.
    }
  }

  const publish = (entry: RuntimeEntry, state: ConfigFormDataSourceState): void => {
    entry.state = cloneState(state)
    touch(entry)
    notify(entry.state)
  }

  const evictOne = (): void => {
    let candidate: RuntimeEntry | undefined
    entries.forEach((entry) => {
      if (!candidate || entry.accessed < candidate.accessed)
        candidate = entry
    })
    if (!candidate)
      return
    candidate.generation += 1
    candidate.active?.cancel(new ConfigFormDataSourceError(
      'CONFIG_FORM_DATA_SOURCE_EVICTED',
      'The data-source scope was evicted from the bounded runtime cache.',
    ))
    candidate.active = undefined
    entries.delete(candidate.key)
  }

  const getOrCreateEntry = (sourceId: string, scopeKey?: string): RuntimeEntry => {
    const key = createEntryKey(sourceId, scopeKey)
    const existing = entries.get(key)
    if (existing) {
      touch(existing)
      return existing
    }
    while (entries.size >= maxEntries)
      evictOne()
    const entry: RuntimeEntry = {
      accessed: 0,
      generation: 0,
      key,
      scopeKey,
      sourceId,
      state: idleState(sourceId, scopeKey),
    }
    entries.set(key, entry)
    touch(entry)
    return entry
  }

  const load = async (
    sourceId: string,
    loadOptions: ConfigFormDataSourceLoadOptions = {},
  ): Promise<ConfigFormDataSourceState> => {
    if (disposed)
      throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_DISPOSED', 'The data-source runtime is disposed.')
    const source = requireSource(sources, sourceId)
    validateLoadOptions(loadOptions)
    const scopeKey = loadOptions.scopeKey
    const entry = getOrCreateEntry(sourceId, scopeKey)

    entry.generation += 1
    const generation = entry.generation
    entry.active?.cancel(new ConfigFormDataSourceError(
      'CONFIG_FORM_DATA_SOURCE_SUPERSEDED',
      `Data-source load ${entry.active.runId} was superseded.`,
    ))
    entry.active = undefined

    runSequence += 1
    const runId = `${sourceId}:${runSequence}`
    const startedAt = Date.now()
    if (loadOptions.signal?.aborted) {
      const error = abortError(loadOptions.signal.reason)
      const state = errorState(sourceId, scopeKey, runId, startedAt, error)
      if (isCurrent(entry, generation))
        publish(entry, state)
      return cloneState(state)
    }

    let context: ConfigFormValueContext
    let request: ConfigFormDataSourceHttpRequestInput
    let dependencyKey: string
    try {
      context = readValueContext(normalizedOptions, loadOptions)
      const resolvedRequest = resolveAt(
        source.request as unknown as ConfigFormValueInput,
        context,
        `${source.definitionPath}.request`,
      )
      request = validateResolvedRequest(resolvedRequest, `${source.definitionPath}.request`)
      const params = loadOptions.params === undefined
        ? undefined
        : validateQuery(
            resolveAt(loadOptions.params as ConfigFormValueInput, context, 'load.options.params'),
            'load.options.params',
          )
      if (params && Object.keys(params).length > 0)
        request = { ...request, query: { ...(request.query ?? {}), ...params } }
      const dependencies = source.dependencies === undefined
        ? []
        : resolveAt(source.dependencies, context, `${source.definitionPath}.dependencies`)
      dependencyKey = getConfigFormJsonSemanticHash({ dependencies, params: params ?? {}, request })
    }
    catch (cause) {
      const error = normalizeError(
        cause,
        'CONFIG_FORM_DATA_SOURCE_INPUT_INVALID',
        'Failed to resolve the data-source request.',
        source.definitionPath,
      )
      const state = errorState(sourceId, scopeKey, runId, startedAt, error)
      if (isCurrent(entry, generation))
        publish(entry, state)
      return cloneState(state)
    }

    if (!isCurrent(entry, generation)) {
      return cloneState(errorState(sourceId, scopeKey, runId, startedAt, new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_SUPERSEDED',
        `Data-source load ${runId} was superseded.`,
      )))
    }

    const now = Date.now()
    if (
      !loadOptions.force
      && entry.cache
      && entry.cache.dependencyKey === dependencyKey
      && now < entry.cache.expiresAt
    ) {
      entry.state = cloneState(entry.cache.state)
      touch(entry)
      return cloneState(entry.state)
    }

    entry.cache = undefined
    const run = createActiveRun(
      runId,
      startedAt,
      generation,
      source.timeoutMs ?? CONFIG_FORM_DATA_SOURCE_DEFAULT_TIMEOUT_MS,
      loadOptions.signal,
    )
    entry.active = run
    publish(entry, {
      runId,
      scopeKey,
      sourceId,
      startedAt,
      status: 'loading',
    })

    if (!isCurrent(entry, generation)) {
      const error = new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_SUPERSEDED',
        `Data-source load ${runId} was superseded.`,
      )
      run.cancel(error)
      run.cleanup()
      return cloneState(errorState(sourceId, scopeKey, runId, startedAt, error))
    }

    try {
      const requestHost = normalizedOptions.host.request
      if (!requestHost) {
        throw new ConfigFormDataSourceError(
          'CONFIG_FORM_DATA_SOURCE_HOST_MISSING',
          'Data-source loading requires the host.request capability.',
          'host.request',
        )
      }
      const hostInput = cloneConfigFormJsonValue(request as unknown as ConfigFormJsonValue) as unknown as ConfigFormDataSourceHttpRequestInput
      const hostPromise = Promise.resolve(requestHost(hostInput, run.controller.signal))
      const rawResponse = await Promise.race([hostPromise, run.cancellation])
      const response = validateResponse(rawResponse, `${source.definitionPath}.response`)
      if (!response.ok) {
        throw new ConfigFormDataSourceError(
          'CONFIG_FORM_DATA_SOURCE_HTTP_STATUS',
          `Data-source request received HTTP ${response.status}.`,
          `${source.definitionPath}.response.status`,
        )
      }
      const data = source.mapping === undefined
        ? response.data
        : resolveAt(
            source.mapping,
            mappingContext(context, response),
            `${source.definitionPath}.mapping`,
          )
      const finishedAt = Date.now()
      const state: ConfigFormDataSourceState = {
        data: cloneRuntimeData(data, `${source.definitionPath}.result`),
        finishedAt,
        runId,
        scopeKey,
        sourceId,
        startedAt,
        status: isEmptyData(data) ? 'empty' : 'success',
      }
      if (!isCurrent(entry, generation)) {
        return cloneState(errorState(sourceId, scopeKey, runId, startedAt, new ConfigFormDataSourceError(
          'CONFIG_FORM_DATA_SOURCE_SUPERSEDED',
          `Data-source load ${runId} was superseded.`,
        )))
      }
      entry.active = undefined
      const cacheTtlMs = source.cacheTtlMs ?? 0
      if (cacheTtlMs > 0) {
        entry.cache = {
          dependencyKey,
          expiresAt: finishedAt + cacheTtlMs,
          state: cloneState(state),
        }
      }
      publish(entry, state)
      return cloneState(state)
    }
    catch (cause) {
      const error = normalizeError(
        cause,
        'CONFIG_FORM_DATA_SOURCE_REQUEST_FAILED',
        'Data-source request failed.',
        source.definitionPath,
      )
      const state = errorState(sourceId, scopeKey, runId, startedAt, error)
      if (isCurrent(entry, generation)) {
        entry.active = undefined
        publish(entry, state)
      }
      return cloneState(state)
    }
    finally {
      run.cleanup()
    }
  }

  const getState = (sourceId: string, scopeKey?: string): ConfigFormDataSourceState => {
    requireSource(sources, sourceId)
    validateScopeKey(scopeKey, 'scopeKey')
    const entry = entries.get(createEntryKey(sourceId, scopeKey))
    if (entry)
      touch(entry)
    return cloneState(entry?.state ?? idleState(sourceId, scopeKey))
  }

  const invalidate = (sourceId?: string, scopeKey?: string): void => {
    if (sourceId !== undefined)
      requireSource(sources, sourceId)
    validateScopeKey(scopeKey, 'scopeKey')
    entries.forEach((entry) => {
      if (matchesEntry(entry, sourceId, scopeKey)) {
        entry.cache = undefined
        touch(entry)
      }
    })
  }

  const reset = (sourceId?: string, scopeKey?: string): void => {
    if (disposed)
      return
    if (sourceId !== undefined)
      requireSource(sources, sourceId)
    validateScopeKey(scopeKey, 'scopeKey')
    const selected = [...entries.values()].filter(entry => matchesEntry(entry, sourceId, scopeKey))
    selected.forEach((entry) => {
      entry.generation += 1
      entry.active?.cancel(new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_RESET',
        'The data-source runtime state was reset.',
      ))
      entry.active = undefined
      entries.delete(entry.key)
      notify(idleState(entry.sourceId, entry.scopeKey))
    })
  }

  const dispose = (): void => {
    if (disposed)
      return
    disposed = true
    entries.forEach((entry) => {
      entry.generation += 1
      entry.active?.cancel(new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_DISPOSED',
        'The data-source runtime was disposed.',
      ))
      entry.active = undefined
    })
    entries.clear()
  }

  return { dispose, getState, invalidate, load, reset }
}

function createActiveRun(
  runId: string,
  startedAt: number,
  generation: number,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): ActiveRun {
  const controller = new AbortController()
  let rejectCancellation!: (error: ConfigFormDataSourceError) => void
  let closed = false
  let timeout: ReturnType<typeof setTimeout> | undefined
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject
  })
  void cancellation.catch(() => undefined)

  const cancel = (error: ConfigFormDataSourceError): void => {
    if (closed)
      return
    closed = true
    controller.abort(error)
    rejectCancellation(error)
  }
  const externalAbort = (): void => cancel(abortError(externalSignal?.reason))
  if (externalSignal)
    externalSignal.addEventListener('abort', externalAbort, { once: true })
  if (timeoutMs > 0) {
    timeout = setTimeout(() => cancel(new ConfigFormDataSourceError(
      'CONFIG_FORM_DATA_SOURCE_TIMEOUT',
      `Data-source request timed out after ${timeoutMs}ms.`,
    )), timeoutMs)
  }

  return {
    cancel,
    cancellation,
    cleanup: () => {
      closed = true
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', externalAbort)
    },
    controller,
    generation,
    runId,
    startedAt,
  }
}

function validateRuntimeOptions(options: ConfigFormDataSourceRuntimeOptions): ConfigFormDataSourceRuntimeOptions {
  assertPlainRecord(options, 'options')
  if (!Array.isArray(options.sources))
    throw definitionError('Runtime sources must be an array.', 'options.sources')
  assertPlainRecord(options.host, 'options.host')
  if (options.host.request !== undefined && typeof options.host.request !== 'function')
    throw definitionError('host.request must be a function.', 'options.host.request')
  if (options.readContext !== undefined && typeof options.readContext !== 'function')
    throw definitionError('readContext must be a function.', 'options.readContext')
  if (options.onState !== undefined && typeof options.onState !== 'function')
    throw definitionError('onState must be a function.', 'options.onState')
  if (options.maxEntries !== undefined && (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0 || options.maxEntries > 10_000))
    throw definitionError('maxEntries must be an integer from 1 through 10000.', 'options.maxEntries')
  return options
}

function normalizeSources(input: readonly ConfigFormDataSourceDefinition[]): ReadonlyMap<string, NormalizedSource> {
  if (input.length > 10_000)
    throw definitionError('Runtime sources exceed the maximum count of 10000.', 'options.sources')
  for (let index = 0; index < input.length; index += 1) {
    if (!Object.hasOwn(input, index))
      throw definitionError('Runtime sources must be a dense array.', `options.sources[${index}]`)
  }
  const result = new Map<string, NormalizedSource>()
  input.forEach((source, index) => {
    const path = `sources[${index}]`
    assertPlainRecord(source, path)
    assertKnownKeys(source, SOURCE_KEYS, path)
    for (const key of ['mapping', 'dependencies', 'auto', 'timeoutMs', 'cacheTtlMs'] as const) {
      if (Object.hasOwn(source, key) && source[key] === undefined)
        throw definitionError(`Data-source ${key} cannot be undefined.`, `${path}.${key}`)
    }
    const id = safeText(source.id, `${path}.id`)
    const name = safeText(source.name, `${path}.name`)
    if (result.has(id)) {
      throw new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_DUPLICATE',
        `Duplicate data-source id: ${id}.`,
        `${path}.id`,
      )
    }
    const request = normalizeRequest(source.request, `${path}.request`)
    const mapping = source.mapping === undefined
      ? undefined
      : cloneValueInput(source.mapping, `${path}.mapping`)
    let dependencies: ConfigFormValueInput[] | undefined
    if (source.dependencies !== undefined) {
      if (!Array.isArray(source.dependencies))
        throw definitionError('Data-source dependencies must be an array.', `${path}.dependencies`)
      dependencies = cloneValueInput(source.dependencies, `${path}.dependencies`) as ConfigFormValueInput[]
    }
    if (source.auto !== undefined && typeof source.auto !== 'boolean')
      throw definitionError('Data-source auto must be a boolean.', `${path}.auto`)
    validateDuration(source.timeoutMs, `${path}.timeoutMs`)
    validateDuration(source.cacheTtlMs, `${path}.cacheTtlMs`)
    result.set(id, {
      auto: source.auto,
      cacheTtlMs: source.cacheTtlMs,
      definitionPath: path,
      dependencies,
      id,
      mapping,
      name,
      request,
      timeoutMs: source.timeoutMs,
    })
  })
  return result
}

function normalizeRequest(input: ConfigFormDataSourceRequestDefinition, path: string): ConfigFormDataSourceRequestDefinition {
  assertPlainRecord(input, path)
  assertKnownKeys(input, REQUEST_KEYS, path)
  if (!Object.hasOwn(input, 'url'))
    throw definitionError('Data-source request requires url.', `${path}.url`)
  return cloneValueInput(input as unknown as ConfigFormValueInput, path) as unknown as ConfigFormDataSourceRequestDefinition
}

function cloneValueInput(input: ConfigFormValueInput, path: string): ConfigFormValueInput {
  try {
    return remapConfigFormValueReferences(input, {})
  }
  catch (cause) {
    if (cause instanceof ConfigFormValueReferenceError) {
      throw new ConfigFormDataSourceError(
        cause.code,
        cause.message,
        prefixValuePath(path, cause.path),
        { cause },
      )
    }
    throw cause
  }
}

function resolveAt(input: ConfigFormValueInput, context: ConfigFormValueContext, path: string): unknown {
  try {
    return resolveConfigFormValueInput(input, context)
  }
  catch (cause) {
    if (cause instanceof ConfigFormValueReferenceError) {
      throw new ConfigFormDataSourceError(
        cause.code,
        cause.message,
        prefixValuePath(path, cause.path),
        { cause },
      )
    }
    throw cause
  }
}

function readValueContext(
  options: ConfigFormDataSourceRuntimeOptions,
  loadOptions: ConfigFormDataSourceLoadOptions,
): ConfigFormValueContext {
  if (loadOptions.context !== undefined)
    return loadOptions.context
  if (!options.readContext)
    return {}
  try {
    return options.readContext()
  }
  catch (cause) {
    throw new ConfigFormDataSourceError(
      'CONFIG_FORM_DATA_SOURCE_CONTEXT_FAILED',
      cause instanceof Error ? cause.message : 'Reading the data-source context failed.',
      'readContext',
      { cause },
    )
  }
}

function validateResolvedRequest(value: unknown, path: string): ConfigFormDataSourceHttpRequestInput {
  assertPlainRecord(value, path)
  assertKnownKeys(value, REQUEST_KEYS, path)
  if (typeof value.url !== 'string' || value.url.trim().length === 0)
    throw inputError('Resolved request url must be a non-empty string.', `${path}.url`)
  const result: ConfigFormDataSourceHttpRequestInput = { url: value.url }
  if (value.method !== undefined) {
    if (typeof value.method !== 'string' || !HTTP_METHODS.has(value.method))
      throw inputError('Resolved request method is invalid.', `${path}.method`)
    result.method = value.method as ConfigFormDataSourceHttpRequestInput['method']
  }
  if (value.headers !== undefined)
    result.headers = validateHeaders(value.headers, `${path}.headers`)
  if (value.query !== undefined)
    result.query = validateQuery(value.query, `${path}.query`)
  if (value.body !== undefined)
    result.body = value.body as ConfigFormJsonValue
  if (value.responseType !== undefined) {
    if (typeof value.responseType !== 'string' || !RESPONSE_TYPES.has(value.responseType))
      throw inputError('Resolved request responseType is invalid.', `${path}.responseType`)
    result.responseType = value.responseType as ConfigFormDataSourceHttpRequestInput['responseType']
  }
  return result
}

function validateHeaders(value: unknown, path: string): Record<string, string> {
  assertPlainRecord(value, path)
  const result: Record<string, string> = {}
  readRecordEntries(value, path).forEach(([key, item]) => {
    if (typeof item !== 'string')
      throw inputError('Resolved request header values must be strings.', `${path}.${key}`)
    result[key] = item
  })
  return result
}

function validateQuery(value: unknown, path: string): Record<string, string | number | boolean> {
  assertPlainRecord(value, path)
  const result: Record<string, string | number | boolean> = {}
  readRecordEntries(value, path).forEach(([key, item]) => {
    if (
      (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean')
      || (typeof item === 'number' && !Number.isFinite(item))
    ) {
      throw inputError('Resolved query values must be strings, finite numbers, or booleans.', `${path}.${key}`)
    }
    result[key] = item
  })
  return result
}

function validateResponse(value: ConfigFormDataSourceHttpRequestOutput, path: string): ConfigFormDataSourceHttpRequestOutput {
  assertPlainRecord(value, path)
  if (!Number.isInteger(value.status) || value.status < 0)
    throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_RESPONSE_INVALID', 'Response status must be a non-negative integer.', `${path}.status`)
  if (typeof value.ok !== 'boolean')
    throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_RESPONSE_INVALID', 'Response ok must be a boolean.', `${path}.ok`)
  if (!Object.hasOwn(value, 'data'))
    throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_RESPONSE_INVALID', 'Response requires a data property.', `${path}.data`)
  return {
    data: cloneRuntimeData(value.data, `${path}.data`),
    ok: value.ok,
    status: value.status,
  }
}

function cloneRuntimeData(value: unknown, path: string): unknown {
  if (value === undefined)
    return undefined
  try {
    return resolveConfigFormValueInput({
      $ref: { kind: 'literal', value: value as ConfigFormJsonValue },
    }, {})
  }
  catch (cause) {
    if (cause instanceof ConfigFormValueReferenceError) {
      throw new ConfigFormDataSourceError(
        'CONFIG_FORM_DATA_SOURCE_DATA_INVALID',
        cause.message,
        prefixValuePath(path, cause.path === '$' ? '$.$ref.value' : cause.path).replace('.$ref.value', ''),
        { cause },
      )
    }
    throw cause
  }
}

function mappingContext(
  context: ConfigFormValueContext,
  response: ConfigFormDataSourceHttpRequestOutput,
): ConfigFormValueContext {
  return {
    fields: context.fields,
    resolveField: context.resolveField,
    response: cloneRuntimeData(response, '$response'),
    variables: context.variables,
  }
}

function createEntryKey(sourceId: string, scopeKey?: string): string {
  return JSON.stringify([sourceId, scopeKey === undefined ? null : scopeKey])
}

function matchesEntry(entry: RuntimeEntry, sourceId?: string, scopeKey?: string): boolean {
  return (sourceId === undefined || entry.sourceId === sourceId)
    && (scopeKey === undefined || entry.scopeKey === scopeKey)
}

function idleState(sourceId: string, scopeKey?: string): ConfigFormDataSourceState {
  return { scopeKey, sourceId, status: 'idle' }
}

function errorState(
  sourceId: string,
  scopeKey: string | undefined,
  runId: string,
  startedAt: number,
  error: ConfigFormDataSourceError,
): ConfigFormDataSourceState {
  return {
    error: diagnostic(error),
    finishedAt: Date.now(),
    runId,
    scopeKey,
    sourceId,
    startedAt,
    status: 'error',
  }
}

function cloneState(state: ConfigFormDataSourceState): ConfigFormDataSourceState {
  const result: ConfigFormDataSourceState = {
    ...(state.error ? { error: { ...state.error } } : {}),
    ...(state.finishedAt === undefined ? {} : { finishedAt: state.finishedAt }),
    ...(state.runId === undefined ? {} : { runId: state.runId }),
    ...(state.scopeKey === undefined ? {} : { scopeKey: state.scopeKey }),
    sourceId: state.sourceId,
    ...(state.startedAt === undefined ? {} : { startedAt: state.startedAt }),
    status: state.status,
  }
  if (Object.hasOwn(state, 'data')) {
    result.data = state.data === undefined
      ? undefined
      : cloneConfigFormJsonValue(state.data as ConfigFormJsonValue)
  }
  return result
}

function diagnostic(error: ConfigFormDataSourceError): ConfigFormDataSourceDiagnostic {
  return {
    code: error.code,
    message: error.message,
    ...(error.path === undefined ? {} : { path: error.path }),
  }
}

function normalizeError(
  cause: unknown,
  fallbackCode: string,
  fallbackMessage: string,
  fallbackPath?: string,
): ConfigFormDataSourceError {
  if (cause instanceof ConfigFormDataSourceError)
    return cause
  return new ConfigFormDataSourceError(
    fallbackCode,
    cause instanceof Error ? cause.message : fallbackMessage,
    fallbackPath,
    { cause },
  )
}

function abortError(reason: unknown): ConfigFormDataSourceError {
  if (reason instanceof ConfigFormDataSourceError)
    return reason
  return new ConfigFormDataSourceError(
    'CONFIG_FORM_DATA_SOURCE_ABORTED',
    reason instanceof Error ? reason.message : 'The data-source request was aborted.',
  )
}

function requireSource(
  sources: ReadonlyMap<string, NormalizedSource>,
  sourceId: string,
): NormalizedSource {
  if (typeof sourceId !== 'string' || sourceId.trim().length === 0 || UNSAFE_KEYS.has(sourceId))
    throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_NOT_FOUND', `Unknown data-source: ${String(sourceId)}.`, 'sourceId')
  const source = sources.get(sourceId)
  if (!source)
    throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_NOT_FOUND', `Unknown data-source: ${sourceId}.`, 'sourceId')
  return source
}

function validateLoadOptions(options: ConfigFormDataSourceLoadOptions): void {
  assertPlainRecord(options, 'load.options')
  validateScopeKey(options.scopeKey, 'load.options.scopeKey')
  if (options.force !== undefined && typeof options.force !== 'boolean')
    throw inputError('load force must be a boolean.', 'load.options.force')
  if (options.params !== undefined)
    assertPlainRecord(options.params, 'load.options.params')
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal))
    throw inputError('load signal must be an AbortSignal.', 'load.options.signal')
}

function validateScopeKey(value: unknown, path: string): void {
  if (value !== undefined && (typeof value !== 'string' || UNSAFE_KEYS.has(value)))
    throw inputError('scopeKey must be a safe string.', path)
}

function validateDuration(value: number | undefined, path: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > MAX_TIMER_MS))
    throw definitionError('Duration must be an integer from 0 through 2147483647.', path)
}

function safeText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || UNSAFE_KEYS.has(value))
    throw definitionError('Expected a safe non-empty string.', path)
  return value
}

function assertKnownKeys(value: object, allowed: ReadonlySet<string>, path: string): void {
  readRecordEntries(value, path).forEach(([key]) => {
    if (!allowed.has(key))
      throw definitionError(`Unknown data-source property: ${key}.`, `${path}.${key}`)
  })
}

function assertPlainRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw definitionError('Expected a plain object.', path)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw definitionError('Expected a plain object.', path)
}

function readRecordEntries(value: object, path: string): Array<[string, unknown]> {
  const result: Array<[string, unknown]> = []
  Reflect.ownKeys(value).forEach((key) => {
    if (typeof key !== 'string')
      throw definitionError('Symbol keys are not supported.', path)
    if (UNSAFE_KEYS.has(key))
      throw new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_UNSAFE_KEY', `Unsafe data-source key: ${key}.`, `${path}.${key}`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
      throw definitionError('Properties must be enumerable data properties.', `${path}.${key}`)
    result.push([key, descriptor.value])
  })
  return result
}

function isEmptyData(value: unknown): boolean {
  return value === null
    || value === undefined
    || value === ''
    || (Array.isArray(value) && value.length === 0)
}

function prefixValuePath(prefix: string, path: string): string {
  if (path === '$')
    return prefix
  return `${prefix}${path.slice(1)}`
}

function inputError(message: string, path: string): ConfigFormDataSourceError {
  return new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_INPUT_INVALID', message, path)
}

function definitionError(message: string, path: string): ConfigFormDataSourceError {
  return new ConfigFormDataSourceError('CONFIG_FORM_DATA_SOURCE_DEFINITION_INVALID', message, path)
}
