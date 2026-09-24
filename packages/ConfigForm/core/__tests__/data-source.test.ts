import type {
  ConfigFormDataSourceDefinition,
  ConfigFormDataSourceHttpRequestInput,
  ConfigFormDataSourceHttpRequestOutput,
  ConfigFormDataSourceState,
} from '../src/data-source'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConfigFormDataSourceRuntime,
} from '../src/data-source'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function response(data: unknown, overrides: Partial<ConfigFormDataSourceHttpRequestOutput> = {}): ConfigFormDataSourceHttpRequestOutput {
  return { data, ok: true, status: 200, ...overrides }
}

function source(overrides: Partial<ConfigFormDataSourceDefinition> = {}): ConfigFormDataSourceDefinition {
  return {
    id: 'users',
    name: 'Users',
    request: { url: '/users', ...overrides.request },
    ...overrides,
  }
}

function errorCode(state: ConfigFormDataSourceState): string | undefined {
  return state.error?.code
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('config form data-source runtime', () => {
  it('has no construction or auto side effects and diagnoses a missing request capability', async () => {
    const request = vi.fn(async () => response([]))
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      sources: [source({ auto: true })],
    })

    expect(request).not.toHaveBeenCalled()
    expect(runtime.getState('users')).toEqual({ sourceId: 'users', status: 'idle' })

    const missing = createConfigFormDataSourceRuntime({ host: {}, sources: [source()] })
    const state = await missing.load('users')
    expect(state.status).toBe('error')
    expect(state.error).toMatchObject({
      code: 'CONFIG_FORM_DATA_SOURCE_HOST_MISSING',
      path: 'host.request',
    })
  })

  it('resolves the complete request through value references and maps the full HTTP response', async () => {
    const endpoint = { value: '/orders' }
    const hostData = { items: [{ id: 7, name: 'Ada' }], meta: { total: 1 } }
    const request = vi.fn(async (_input: ConfigFormDataSourceHttpRequestInput, _signal: AbortSignal) => response(hostData))
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      sources: [source({
        mapping: { $ref: { kind: 'response', path: ['data', 'items'] } },
        request: {
          url: { $ref: { kind: 'variable', variableId: 'endpoint' } },
          method: 'POST',
          headers: {
            authorization: { $ref: { kind: 'variable', variableId: 'token' } },
          },
          query: {
            page: { $ref: { kind: 'field', nodeId: 'page' } },
            active: true,
          },
          body: {
            owner: { $ref: { kind: 'expression', source: '$fields["owner"]' } },
          },
          responseType: 'json',
        },
      })],
    })

    const state = await runtime.load('users', {
      context: {
        fields: { owner: 'Ada', page: 2 },
        variables: { endpoint: endpoint.value, token: 'Bearer secret' },
      },
    })

    expect(state).toMatchObject({
      data: [{ id: 7, name: 'Ada' }],
      sourceId: 'users',
      status: 'success',
    })
    expect(state.runId).toBe('users:1')
    expect(state.finishedAt).toBeGreaterThanOrEqual(state.startedAt!)
    expect(request).toHaveBeenCalledTimes(1)
    const [input, signal] = request.mock.calls[0]!
    expect(input).toEqual({
      body: { owner: 'Ada' },
      headers: { authorization: 'Bearer secret' },
      method: 'POST',
      query: { active: true, page: 2 },
      responseType: 'json',
      url: '/orders',
    })
    expect(signal).toBeInstanceOf(AbortSignal)

    ;(state.data as Array<{ name: string }>)[0]!.name = 'Changed'
    hostData.items[0]!.name = 'Host changed'
    expect(runtime.getState('users').data).toEqual([{ id: 7, name: 'Ada' }])
    expect(endpoint.value).toBe('/orders')
  })

  it('resolves consumer params through ValueInput and isolates their request identities', async () => {
    const request = vi.fn(async (input: ConfigFormDataSourceHttpRequestInput) => response(input.query))
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      sources: [source({ request: { url: '/users', query: { fixed: true } } })],
    })

    const first = await runtime.load('users', {
      context: { variables: { tenant: 'alpha' } },
      params: { tenant: { $ref: { kind: 'variable', variableId: 'tenant' } } },
      scopeKey: 'row-a:alpha',
    })
    const second = await runtime.load('users', {
      context: { variables: { tenant: 'beta' } },
      params: { tenant: { $ref: { kind: 'variable', variableId: 'tenant' } } },
      scopeKey: 'row-a:beta',
    })

    expect(first.data).toEqual({ fixed: true, tenant: 'alpha' })
    expect(second.data).toEqual({ fixed: true, tenant: 'beta' })
    expect(request.mock.calls.map(([input]) => input.query)).toEqual([
      { fixed: true, tenant: 'alpha' },
      { fixed: true, tenant: 'beta' },
    ])
  })

  it('keys cache entries by resolved request and dependencies, and honors force, invalidate, and TTL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    let revision = 0
    let currentTenant = 'a'
    const request = vi.fn(async () => response({ revision: ++revision }))
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      readContext: () => ({ variables: { tenant: currentTenant } }),
      sources: [source({
        cacheTtlMs: 1_000,
        dependencies: [{ $ref: { kind: 'variable', variableId: 'tenant' } }],
        request: {
          url: { $ref: { kind: 'expression', source: 'CONCAT("/users/", $variables["tenant"])' } },
        },
      })],
    })

    expect((await runtime.load('users')).data).toEqual({ revision: 1 })
    expect((await runtime.load('users')).data).toEqual({ revision: 1 })
    expect(request).toHaveBeenCalledTimes(1)

    currentTenant = 'b'
    expect((await runtime.load('users')).data).toEqual({ revision: 2 })
    expect((await runtime.load('users', { force: true })).data).toEqual({ revision: 3 })
    runtime.invalidate('users')
    expect((await runtime.load('users')).data).toEqual({ revision: 4 })

    await vi.advanceTimersByTimeAsync(1_001)
    expect((await runtime.load('users')).data).toEqual({ revision: 5 })
    expect(request).toHaveBeenCalledTimes(5)
  })

  it('isolates latest runs per source and scope and ignores late host results', async () => {
    const pending: Array<Deferred<ConfigFormDataSourceHttpRequestOutput>> = []
    const states: ConfigFormDataSourceState[] = []
    const request = vi.fn(() => {
      const next = deferred<ConfigFormDataSourceHttpRequestOutput>()
      pending.push(next)
      return next.promise
    })
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      onState: state => states.push(state),
      sources: [source()],
    })

    const first = runtime.load('users')
    const second = runtime.load('users')
    expect(request).toHaveBeenCalledTimes(2)
    pending[1]!.resolve(response({ version: 2 }))
    await expect(second).resolves.toMatchObject({ data: { version: 2 }, status: 'success' })
    await expect(first).resolves.toMatchObject({
      error: { code: 'CONFIG_FORM_DATA_SOURCE_SUPERSEDED' },
      status: 'error',
    })

    const stateCount = states.length
    pending[0]!.resolve(response({ version: 1 }))
    await Promise.resolve()
    expect(runtime.getState('users')).toMatchObject({ data: { version: 2 }, status: 'success' })
    expect(states).toHaveLength(stateCount)

    const left = runtime.load('users', { scopeKey: 'left' })
    const right = runtime.load('users', { scopeKey: 'right' })
    pending[3]!.resolve(response('right'))
    pending[2]!.resolve(response('left'))
    await expect(left).resolves.toMatchObject({ data: 'left', scopeKey: 'left' })
    await expect(right).resolves.toMatchObject({ data: 'right', scopeKey: 'right' })
    expect(runtime.getState('users', 'left').data).toBe('left')
    expect(runtime.getState('users', 'right').data).toBe('right')
  })

  it('settles abort, reset, and dispose even when the host ignores AbortSignal', async () => {
    const abortSignals: AbortSignal[] = []
    const abortRuntime = createConfigFormDataSourceRuntime({
      host: {
        request: (_input, signal) => {
          abortSignals.push(signal)
          return new Promise(() => {})
        },
      },
      sources: [source({ timeoutMs: 0 })],
    })
    const controller = new AbortController()
    const aborted = abortRuntime.load('users', { signal: controller.signal })
    controller.abort('left-page')
    await expect(aborted).resolves.toMatchObject({
      error: { code: 'CONFIG_FORM_DATA_SOURCE_ABORTED' },
      status: 'error',
    })
    expect(abortSignals[0]!.aborted).toBe(true)

    const resetDeferred = deferred<ConfigFormDataSourceHttpRequestOutput>()
    const resetStates: ConfigFormDataSourceState[] = []
    const resetRuntime = createConfigFormDataSourceRuntime({
      host: { request: () => resetDeferred.promise },
      onState: state => resetStates.push(state),
      sources: [source({ timeoutMs: 0 })],
    })
    const resetLoad = resetRuntime.load('users')
    resetRuntime.reset('users')
    await expect(resetLoad).resolves.toMatchObject({
      error: { code: 'CONFIG_FORM_DATA_SOURCE_RESET' },
      status: 'error',
    })
    expect(resetRuntime.getState('users').status).toBe('idle')
    const resetCount = resetStates.length
    resetDeferred.resolve(response('late reset'))
    await Promise.resolve()
    expect(resetStates).toHaveLength(resetCount)

    const disposeDeferred = deferred<ConfigFormDataSourceHttpRequestOutput>()
    const disposeStates: ConfigFormDataSourceState[] = []
    const disposeRuntime = createConfigFormDataSourceRuntime({
      host: { request: () => disposeDeferred.promise },
      onState: state => disposeStates.push(state),
      sources: [source({ timeoutMs: 0 })],
    })
    const disposedLoad = disposeRuntime.load('users')
    disposeRuntime.dispose()
    await expect(disposedLoad).resolves.toMatchObject({
      error: { code: 'CONFIG_FORM_DATA_SOURCE_DISPOSED' },
      status: 'error',
    })
    const disposeCount = disposeStates.length
    disposeDeferred.resolve(response('late dispose'))
    await Promise.resolve()
    expect(disposeStates).toHaveLength(disposeCount)
    expect(disposeRuntime.getState('users').status).toBe('idle')
    await expect(disposeRuntime.load('users')).rejects.toMatchObject({
      code: 'CONFIG_FORM_DATA_SOURCE_DISPOSED',
    })
  })

  it('uses a 10000ms default timeout and lets zero disable timeout', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const timedRuntime = createConfigFormDataSourceRuntime({
      host: {
        request: (_input, signal) => {
          signals.push(signal)
          return new Promise(() => {})
        },
      },
      sources: [source()],
    })
    const timed = timedRuntime.load('users')
    await vi.advanceTimersByTimeAsync(9_999)
    expect(timedRuntime.getState('users').status).toBe('loading')
    await vi.advanceTimersByTimeAsync(1)
    await expect(timed).resolves.toMatchObject({
      error: { code: 'CONFIG_FORM_DATA_SOURCE_TIMEOUT' },
      status: 'error',
    })
    expect(signals[0]!.aborted).toBe(true)

    const pending = deferred<ConfigFormDataSourceHttpRequestOutput>()
    const untimedRuntime = createConfigFormDataSourceRuntime({
      host: { request: () => pending.promise },
      sources: [source({ timeoutMs: 0 })],
    })
    const untimed = untimedRuntime.load('users')
    await vi.advanceTimersByTimeAsync(50_000)
    expect(untimedRuntime.getState('users').status).toBe('loading')
    pending.resolve(response('done'))
    await expect(untimed).resolves.toMatchObject({ data: 'done', status: 'success' })
  })

  it('publishes deterministic failed and empty states and isolates observer snapshots', async () => {
    const observed: ConfigFormDataSourceState[] = []
    const runtime = createConfigFormDataSourceRuntime({
      host: {
        request: async (input) => {
          if (input.url === '/bad-status')
            return response({ message: 'down' }, { ok: false, status: 503 })
          if (input.url === '/throw')
            throw new Error('network down')
          if (input.url === '/empty')
            return response([])
          return response({ nested: { value: 1 } })
        },
      },
      onState: state => observed.push(state),
      sources: [
        source({ id: 'bad', request: { url: '/bad-status' } }),
        source({ id: 'throw', request: { url: '/throw' } }),
        source({ id: 'empty', request: { url: '/empty' } }),
        source({ id: 'success', request: { url: '/success' } }),
      ],
    })

    expect(errorCode(await runtime.load('bad'))).toBe('CONFIG_FORM_DATA_SOURCE_HTTP_STATUS')
    expect(errorCode(await runtime.load('throw'))).toBe('CONFIG_FORM_DATA_SOURCE_REQUEST_FAILED')
    await expect(runtime.load('empty')).resolves.toMatchObject({ data: [], status: 'empty' })
    const successful = await runtime.load('success')
    ;(successful.data as { nested: { value: number } }).nested.value = 9
    const observedSuccess = observed.findLast(state => state.sourceId === 'success' && state.status === 'success')!
    ;(observedSuccess.data as { nested: { value: number } }).nested.value = 8
    expect(runtime.getState('success').data).toEqual({ nested: { value: 1 } })
  })

  it('bounds source/scope entries and evicts least recently used snapshots', async () => {
    const request = vi.fn(async input => response(input.url))
    const runtime = createConfigFormDataSourceRuntime({
      host: { request },
      maxEntries: 1,
      sources: [source({ cacheTtlMs: 10_000 })],
    })

    await runtime.load('users', { scopeKey: 'first' })
    await runtime.load('users', { scopeKey: 'second' })
    expect(runtime.getState('users', 'first').status).toBe('idle')
    await runtime.load('users', { scopeKey: 'first' })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('rejects duplicate and malformed definitions, including invalid reference graphs', () => {
    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source(), source()],
    })).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_DATA_SOURCE_DUPLICATE',
      path: 'sources[1].id',
    }))

    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({ timeoutMs: -1 })],
    })).toThrowError(expect.objectContaining({ code: 'CONFIG_FORM_DATA_SOURCE_DEFINITION_INVALID' }))

    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({ request: { url: cycle as never } })],
    })).toThrowError(expect.objectContaining({ code: 'CONFIG_FORM_VALUE_CYCLE' }))

    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({ request: { url: new Date() as never } })],
    })).toThrowError(expect.objectContaining({ code: 'CONFIG_FORM_VALUE_INPUT_INVALID' }))

    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({ mapping: { $ref: { kind: 'event', path: ['data'] } } as never })],
    })).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_REFERENCE_INVALID',
      path: 'sources[0].mapping.$ref.kind',
    }))

    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({
        mapping: { $ref: { kind: 'expression', source: '$event.data' } },
      })],
    })).toThrowError(expect.objectContaining({
      code: 'CONFIG_FORM_VALUE_EXPRESSION_IDENTIFIER_UNTRACKABLE',
      path: 'sources[0].mapping',
    }))

    let deep: unknown = null
    for (let index = 0; index < 33; index += 1)
      deep = [deep]
    expect(() => createConfigFormDataSourceRuntime({
      host: {},
      sources: [source({ request: { url: deep as never } })],
    })).toThrowError(expect.objectContaining({ code: 'CONFIG_FORM_VALUE_DEPTH_EXCEEDED' }))
  })
})
