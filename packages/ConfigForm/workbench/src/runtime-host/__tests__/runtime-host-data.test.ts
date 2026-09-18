// @vitest-environment happy-dom
import type { ConfigFormRendererExpose } from '@moluoxixi/config-form'
import type { ConfigFormDataSourceHost } from '@moluoxixi/config-form-core'
import type { RuntimeHostSyncMessage, RuntimeHostToParentMessage } from '../types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { compileDataFixture } from '../../project/__tests__/data-runtime-fixture'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '../constants'
import RuntimeHostApp from '../index.vue'
import { isParentToRuntimeHostMessage, isRuntimeHostToParentMessage } from '../schemas'
import { createRuntimeHostDataExecutor } from '../services/data-rpc'

type RuntimeDataExpose = ConfigFormRendererExpose & {
  getOptionState: ConfigFormRendererExpose['getOptionState']
  getVariables: ConfigFormRendererExpose['getVariables']
  getDataSourceState: ConfigFormRendererExpose['getDataSourceState']
}

const adapter = vi.hoisted(() => ({ load: vi.fn() }))
vi.mock('../../adapters', () => ({ loadWorkbenchRuntimeAdapter: adapter.load }))

describe('real RuntimeHost data capability', () => {
  it.each(['preview', 'design'] as const)('keeps the only data-source manager in the %s renderer', async (mode) => {
    const fixture = compileDataFixture()
    adapter.load.mockResolvedValue({ runtimeResolver: fixture.resolver })
    const request = vi.fn<NonNullable<ConfigFormDataSourceHost['request']>>(async () => ({ ok: true, status: 200, data: [{ label: 'A', value: 'a' }] }))
    let sequence = 0
    const base = () => ({ channel: RUNTIME_HOST_CHANNEL, version: RUNTIME_HOST_PROTOCOL_VERSION, hostId: 'data-host', projectId: 'data-preview', pageId: 'home', revision: '1', sequence: ++sequence })
    const messages: RuntimeHostToParentMessage[] = []
    const dispatch = (payload: object) => {
      const message = { ...base(), ...payload }
      expect(isParentToRuntimeHostMessage(message)).toBe(true)
      window.dispatchEvent(new MessageEvent('message', { data: message, source: window.parent, origin: window.location.origin }))
    }
    const executor = createRuntimeHostDataExecutor({
      getHost: () => ({ request }),
      isCurrent: candidate => candidate.revision === '1',
      postResult: dispatch,
    })
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation((payload) => {
      expect(isRuntimeHostToParentMessage(payload)).toBe(true)
      const message = payload as RuntimeHostToParentMessage
      messages.push(message)
      if (message.type === 'dataRequest')
        executor.handleRequest(message)
      if (message.type === 'dataCancel')
        executor.handleCancel(message)
    })
    const wrapper = mount(RuntimeHostApp)
    try {
      expect(request).not.toHaveBeenCalled()
      dispatch({
        type: 'sync',
        adapter: 'element-plus',
        compilation: fixture.compilation,
        locale: 'en-US',
        mode,
        ...(mode === 'preview' ? { dataSourceRequest: true } : { design: { breakpoint: 'desktop', variant: 'canvas' } }),
        runtimeSessionKey: 'data-session',
        runtimeState: { fields: [], values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
      } satisfies Omit<RuntimeHostSyncMessage, keyof ReturnType<typeof base>>)
      await vi.waitFor(() => expect(messages.some(message => message.type === 'ready')).toBe(true))
      const renderer = wrapper.getComponent({ name: 'ConfigFormRenderer' })
      const api = renderer.vm as unknown as RuntimeDataExpose
      if (mode === 'design') {
        expect(renderer.props('dataSourceHost')).toBeUndefined()
        expect(request).not.toHaveBeenCalled()
        expect(messages.some(message => message.type === 'dataRequest')).toBe(false)
        return
      }
      await vi.waitFor(() => expect(api.getOptionState({ nodeId: 'choice', scope: [] })?.status).toBe('success'))
      expect(api.getVariables()).toEqual({ region: 'US' })
      expect(request).toHaveBeenCalledWith({ url: '/choices', query: { region: 'US' } }, expect.any(AbortSignal))
      const initialRequests = request.mock.calls.length
      expect(api.getDataSourceState('choices')).toMatchObject({ status: 'success' })
      expect(request).toHaveBeenCalledTimes(initialRequests)
      expect(initialRequests).toBe(1)
      expect(messages.filter(message => message.type === 'error')).toEqual([])
    }
    finally {
      wrapper.unmount()
      executor.dispose()
      post.mockRestore()
    }
  })
})
