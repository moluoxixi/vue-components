import type { ConfigFormDataSourceHost, ConfigFormDataSourceHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { RuntimeHostDataCancelMessage, RuntimeHostDataRequestMessage, RuntimeHostDataResultMessage, RuntimeHostIdentity, RuntimeHostMessageBase } from '../types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import { isParentToRuntimeHostMessage, isRuntimeHostToParentMessage } from '../schemas'
import { createRuntimeHostDataExecutor, createRuntimeHostDataProxy } from '../services/data-rpc'

const identity = { hostId: 'host', projectId: 'project', pageId: 'page', revision: '1' }
const response = (data: unknown): ConfigFormDataSourceHttpRequestOutput => ({ ok: true, status: 200, data })
function deferred() {
  let resolve!: (value: ConfigFormDataSourceHttpRequestOutput) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<ConfigFormDataSourceHttpRequestOutput>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function bridge(host?: ConfigFormDataSourceHost, settings: { hostDeadline?: number, proxyDeadline?: number } = {}) {
  let current = { ...identity }
  let childSequence = 0
  let parentSequence = 0
  let deliver = true
  const requests: RuntimeHostDataRequestMessage[] = []
  const results: RuntimeHostDataResultMessage[] = []
  const cancels: RuntimeHostDataCancelMessage[] = []
  const base = (sequence = 0): RuntimeHostMessageBase => ({ channel: RUNTIME_HOST_CHANNEL, version: RUNTIME_HOST_PROTOCOL_VERSION, ...current, sequence })
  const isCurrent = (candidate: RuntimeHostIdentity) => Object.entries(current).every(([key, value]) => candidate[key as keyof RuntimeHostIdentity] === value)
  let proxy!: ReturnType<typeof createRuntimeHostDataProxy>
  const executor = createRuntimeHostDataExecutor({
    getHost: () => host,
    isCurrent,
    defaultDeadlineMs: settings.hostDeadline,
    postResult: (payload) => {
      const result = { ...base(++parentSequence), ...payload }
      expect(isParentToRuntimeHostMessage(result)).toBe(true)
      results.push(result)
      if (deliver)
        proxy.acceptResult(result)
    },
  })
  proxy = createRuntimeHostDataProxy({
    getBase: base,
    isCurrent,
    defaultDeadlineMs: settings.proxyDeadline,
    postRequest: (payload) => {
      const message = { ...base(++childSequence), ...payload }
      expect(isRuntimeHostToParentMessage(message)).toBe(true)
      requests.push(message)
      executor.handleRequest(message)
    },
    postCancel: (payload) => {
      const message = { ...base(++childSequence), ...payload }
      expect(isRuntimeHostToParentMessage(message)).toBe(true)
      cancels.push(message)
      executor.handleCancel(message)
    },
  })
  return {
    proxy,
    executor,
    requests,
    results,
    cancels,
    base,
    request: proxy.getDataSourceHost().request!,
    holdResults: () => { deliver = false },
    changeIdentity: () => { current = { ...current, revision: '2' } },
    dispose: () => {
      proxy.dispose()
      executor.dispose()
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('request-only RuntimeHost RPC', () => {
  it('keeps independent calls, response failures and no synthetic form context', async () => {
    const pending = [deferred(), deferred()]
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>()
      .mockImplementationOnce(() => pending[0]!.promise)
      .mockImplementationOnce(() => pending[1]!.promise)
    const rpc = bridge({ request })
    const input = { url: '/choices', query: { country: 'US' } }
    const first = rpc.request(input, new AbortController().signal)
    const second = rpc.request({ url: '/other' }, new AbortController().signal)
    input.query.country = 'changed'
    expect(rpc.requests[0]?.input).toEqual({ url: '/choices', query: { country: 'US' } })
    expect(Object.keys(rpc.requests[0]!).sort()).toEqual(['channel', 'hostId', 'input', 'pageId', 'projectId', 'requestId', 'revision', 'sequence', 'type', 'version'])
    expect(request.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)
    expect(request.mock.calls[0]).toHaveLength(2)
    pending[1]!.resolve({ status: 503, ok: false, data: { message: 'Offline' } })
    await expect(second).resolves.toMatchObject({ status: 503, ok: false })
    expect(rpc.proxy.pendingCount()).toBe(1)
    pending[0]!.resolve(response(['A']))
    await expect(first).resolves.toEqual(response(['A']))
    expect(rpc.executor.pendingCount()).toBe(0)
    rpc.dispose()
  })

  it('requires the explicit request capability and serializes bounded errors', async () => {
    const absent = bridge()
    await expect(absent.request({ url: '/choices' }, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_DATA_HOST_UNAVAILABLE', path: 'dataSourceHost.request' })
    absent.dispose()
    const rpc = bridge({ request: async () => {
      throw Object.assign(new Error('m'.repeat(5000)), { code: 'c'.repeat(500), path: 'p'.repeat(3000) })
    } })
    await expect(rpc.request({ url: '/choices' }, new AbortController().signal)).rejects.toMatchObject({ code: 'c'.repeat(256), message: 'm'.repeat(4096), path: 'p'.repeat(2048) })
    expect(rpc.results).toHaveLength(1)
    rpc.dispose()
  })

  it('aborts only the cancelled request and discards a host that resolves late', async () => {
    const late = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => late.promise)
    const rpc = bridge({ request })
    const controller = new AbortController()
    const pending = rpc.request({ url: '/choices' }, controller.signal)
    const rejection = expect(pending).rejects.toMatchObject({ code: 'RUNTIME_DATA_ABORTED' })
    controller.abort()
    await rejection
    expect(request.mock.calls[0]?.[1].aborted).toBe(true)
    expect(rpc.cancels).toHaveLength(1)
    expect(rpc.proxy.pendingCount()).toBe(0)
    const count = rpc.results.length
    late.resolve(response('late'))
    await Promise.resolve()
    expect(rpc.results).toHaveLength(count)
    rpc.dispose()
  })

  it.each(['proxy', 'host'] as const)('bounds the %s deadline independently even when the other side never completes', async (side) => {
    vi.useFakeTimers()
    const late = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => late.promise)
    const rpc = bridge({ request }, side === 'proxy' ? { hostDeadline: 20_000 } : { proxyDeadline: 20_000 })
    const pending = rpc.request({ url: '/choices' }, new AbortController().signal)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'RUNTIME_DATA_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
    expect(request.mock.calls[0]?.[1].aborted).toBe(true)
    expect(rpc.proxy.pendingCount()).toBe(0)
    expect(rpc.executor.pendingCount()).toBe(0)
    const count = rpc.results.length
    late.resolve(response('late'))
    await Promise.resolve()
    expect(rpc.results).toHaveLength(count)
    rpc.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects foreign identities, duplicate IDs and replayed requests without disturbing the original', async () => {
    const late = deferred()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => late.promise)
    const rpc = bridge({ request })
    rpc.holdResults()
    const promise = rpc.request({ url: '/choices' }, new AbortController().signal)
    const message = rpc.requests[0]!
    expect(rpc.executor.handleRequest({ ...message, sequence: 2 })).toBe(false)
    for (const key of ['hostId', 'projectId', 'pageId', 'revision'] as const) {
      expect(rpc.executor.handleRequest({ ...message, requestId: 'foreign', sequence: 99, [key]: 'foreign' })).toBe(false)
      expect(rpc.executor.handleCancel({ ...message, type: 'dataCancel', sequence: 100, [key]: 'foreign' })).toBe(false)
    }
    late.resolve(response('ok'))
    await Promise.resolve()
    const result = rpc.results[0]!
    for (const key of ['hostId', 'projectId', 'pageId', 'revision'] as const)
      expect(rpc.proxy.acceptResult({ ...result, [key]: 'foreign' })).toBe(false)
    expect(rpc.executor.handleRequest({ ...message, sequence: 3 })).toBe(false)
    expect(request).toHaveBeenCalledOnce()
    expect(rpc.proxy.acceptResult(result)).toBe(true)
    expect(rpc.proxy.acceptResult(result)).toBe(false)
    await expect(promise).resolves.toEqual(response('ok'))
    rpc.dispose()
  })

  it('synchronously invalidates pending calls and discards held results after identity change', async () => {
    const rpc = bridge({ request: async () => response('old') })
    rpc.holdResults()
    const pending = rpc.request({ url: '/choices' }, new AbortController().signal)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'RUNTIME_DATA_STALE' })
    await Promise.resolve()
    rpc.changeIdentity()
    expect(rpc.proxy.acceptResult(rpc.results[0]!)).toBe(false)
    await assertion
    rpc.dispose()
  })

  it('bounds both queues at 100 and synchronously aborts on disposal', async () => {
    vi.useFakeTimers()
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => new Promise(() => {}))
    const rpc = bridge({ request })
    const calls = Array.from({ length: 100 }, () => rpc.request({ url: '/choices' }, new AbortController().signal).catch(error => error))
    await expect(rpc.request({ url: '/choices' }, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_DATA_QUEUE_LIMIT' })
    expect(rpc.executor.handleRequest({ ...rpc.base(101), type: 'dataRequest', requestId: 'overflow', input: { url: '/choices' } })).toBe(false)
    expect(rpc.results.at(-1)).toMatchObject({ diagnostic: { code: 'RUNTIME_DATA_QUEUE_LIMIT' } })
    expect(request).toHaveBeenCalledTimes(100)
    rpc.dispose()
    expect(request.mock.calls.every(([, signal]) => signal.aborted)).toBe(true)
    expect(rpc.proxy.pendingCount()).toBe(0)
    expect(rpc.executor.pendingCount()).toBe(0)
    expect(await Promise.all(calls)).toHaveLength(100)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects non-JSON input and output, dangerous keys, oversized messages and unsafe URLs', async () => {
    const request = vi.fn(async () => response({ unsupported: new Date() }))
    const rpc = bridge({ request })
    const invalid = [{ url: 'javascript:alert(1)' }, { url: '' }, { url: '/choices', query: { nested: {} } }, { url: '/choices', headers: { token: 1 } }, { url: '/choices', body: JSON.parse('{"constructor":0}') }, { url: '/choices', body: 'x'.repeat(16_385) }, { url: '/choices', body: Array.from({ length: 10_001 }).fill(1) }]
    for (const input of invalid) {
      expect(rpc.executor.handleRequest({ ...rpc.base(1), type: 'dataRequest', requestId: 'invalid', input } as RuntimeHostDataRequestMessage)).toBe(false)
      await expect(rpc.request(input as { url: string }, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_DATA_INPUT_INVALID' })
    }
    expect(request).not.toHaveBeenCalled()
    await expect(rpc.request({ url: '/choices' }, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_DATA_OUTPUT_INVALID' })
    const message = { ...rpc.base(2), type: 'dataRequest', requestId: 'valid', input: { url: '/choices' } }
    expect(isRuntimeHostToParentMessage({ ...message, extra: JSON.parse('{"prototype":0}') })).toBe(false)
    expect(isParentToRuntimeHostMessage({ ...rpc.base(2), type: 'dataResult', requestId: 'valid', success: false, diagnostic: { code: 'error', message: 'failed', path: 'x'.repeat(2049) } })).toBe(false)
    rpc.dispose()
  })
})
