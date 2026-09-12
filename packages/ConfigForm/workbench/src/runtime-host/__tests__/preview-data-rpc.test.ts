// @vitest-environment happy-dom
import type { ConfigFormDataSourceHost, ConfigFormFlowHttpRequestOutput } from '@moluoxixi/config-form-core'
import type { RuntimeHostMessageBase, RuntimeHostSyncMessage } from '../types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreviewRuntimeHostFrame from '../../app/components/PreviewRuntimeHostFrame/index.vue'
import { compileDataFixture } from '../../project/__tests__/data-runtime-fixture'
import { createRuntimeHostDataProxy } from '../services/data-rpc'

afterEach(() => vi.restoreAllMocks())

async function frameBridge(host?: ConfigFormDataSourceHost) {
  const fixture = compileDataFixture()
  const wrapper = mount(PreviewRuntimeHostFrame, { props: {
    adapter: 'element-plus', compilation: fixture.compilation, locale: 'en-US',
    revision: '1', runtimeSessionKey: 'session', title: 'Preview', dataSourceHost: host,
    runtimeState: { fields: [], values: {}, touched: [], validation: {} },
    reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
  } })
  let base!: RuntimeHostMessageBase
  let childSequence = 0
  let sync!: RuntimeHostSyncMessage
  const results: unknown[] = []
  let proxy!: ReturnType<typeof createRuntimeHostDataProxy>
  const source = { postMessage: vi.fn((message) => {
    if (message.type === 'sync') {
      sync = message
      const { channel, version, hostId, projectId, pageId, revision } = message
      base = { channel, version, hostId, projectId, pageId, revision, sequence: 0 }
    }
    if (message.type === 'dataResult') {
      results.push(message)
      proxy.acceptResult(message)
    }
  }) } as unknown as Window
  Object.defineProperty(wrapper.get('iframe').element, 'contentWindow', { configurable: true, value: source })
  const dispatch = (payload: object, options: { base?: Partial<RuntimeHostMessageBase>, origin?: string, source?: MessageEventSource } = {}) => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { ...base, sequence: ++childSequence, ...payload, ...options.base },
      origin: options.origin ?? window.location.origin,
      source: options.source ?? source,
    }))
  }
  proxy = createRuntimeHostDataProxy({
    getBase: () => base,
    isCurrent: candidate => candidate.revision === base.revision,
    postRequest: dispatch,
    postCancel: dispatch,
  })
  await wrapper.get('iframe').trigger('load')
  return { wrapper, proxy, results, dispatch, sync, source, request: proxy.getDataSourceHost().request! }
}

describe('Preview frame request RPC wiring', () => {
  it('advertises only the explicit request capability and validates the frame source, origin and identity', async () => {
    const request = vi.fn(async () => ({ ok: true, status: 200, data: ['A'] }))
    const rpc = await frameBridge({ request })
    try {
      expect(rpc.sync.dataSourceRequest).toBe(true)
      expect(request).not.toHaveBeenCalled()
      const payload = { type: 'dataRequest', requestId: 'foreign', input: { url: '/choices' } }
      rpc.dispatch(payload, { origin: 'https://foreign.test' })
      rpc.dispatch(payload, { source: {} as Window })
      for (const key of ['hostId', 'pageId', 'projectId', 'revision'] as const)
        rpc.dispatch(payload, { base: { [key]: 'foreign' } })
      expect(request).not.toHaveBeenCalled()
      await expect(rpc.request({ url: '/choices' }, new AbortController().signal)).resolves.toEqual({ ok: true, status: 200, data: ['A'] })
      expect(request).toHaveBeenCalledOnce()
      expect(rpc.results).toHaveLength(1)
    }
    finally {
      rpc.proxy.dispose()
      rpc.wrapper.unmount()
    }
  })

  it.each(['revision', 'reload', 'unmount', 'host'] as const)('aborts the trusted host on %s and ignores late completion', async (change) => {
    let resolve!: (value: ConfigFormFlowHttpRequestOutput) => void
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(() => new Promise(done => resolve = done))
    const rpc = await frameBridge({ request })
    const pending = rpc.request({ url: '/choices' }, new AbortController().signal).catch(error => error)
    try {
      expect(request).toHaveBeenCalledOnce()
      if (change === 'revision')
        await rpc.wrapper.setProps({ revision: '2' })
      else if (change === 'host')
        await rpc.wrapper.setProps({ dataSourceHost: undefined })
      else if (change === 'reload')
        await rpc.wrapper.get('iframe').trigger('load')
      else
        rpc.wrapper.unmount()
      expect(request.mock.calls[0]?.[1].aborted).toBe(true)
      resolve({ ok: true, status: 200, data: 'late' })
      await flushPromises()
      expect(rpc.results).toEqual([])
    }
    finally {
      rpc.proxy.dispose()
      await pending
      if (rpc.wrapper.exists())
        rpc.wrapper.unmount()
    }
  })

  it('does not fall back to parent fetch when no host was supplied', async () => {
    const fetchHost = vi.spyOn(globalThis, 'fetch')
    const rpc = await frameBridge()
    try {
      expect(rpc.sync.dataSourceRequest).toBe(false)
      await expect(rpc.request({ url: '/choices' }, new AbortController().signal)).rejects.toMatchObject({ code: 'RUNTIME_DATA_HOST_UNAVAILABLE' })
      expect(fetchHost).not.toHaveBeenCalled()
    }
    finally {
      rpc.proxy.dispose()
      rpc.wrapper.unmount()
    }
  })
})
