// @vitest-environment happy-dom

import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { RUNTIME_HOST_CHANNEL, RUNTIME_HOST_PROTOCOL_VERSION } from '..'
import { PreviewRuntimeHostFrame } from '../../app'

const hostId = '11111111-1111-4111-8111-111111111111'

afterEach(() => vi.restoreAllMocks())

describe('preview RuntimeHost frame', () => {
  it('adds a stable host identity to mounted events and ignores replayed messages', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const compilation = {
      snapshotIdentity: { projectId: 'project', pageId: 'home' },
    } as PageCompilation
    const wrapper = mount(PreviewRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        compilation,
        locale: 'en-US',
        runtimeState: { fields: flatFields(), values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
        revision: 'project:4:home:1',
        runtimeSessionKey: 'project:element-plus:home',
        title: 'Preview Runtime',
      },
    })
    const source = { postMessage: vi.fn() } as unknown as Window
    Object.defineProperty(wrapper.get('iframe').element, 'contentWindow', { configurable: true, value: source })
    const message = {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: 'project',
      pageId: 'home',
      sequence: 1,
      revision: 'project:4:home:1',
      type: 'mounted',
    }

    window.dispatchEvent(new MessageEvent('message', {
      data: message,
      origin: window.location.origin,
      source,
    }))
    window.dispatchEvent(new MessageEvent('message', {
      data: message,
      origin: window.location.origin,
      source,
    }))
    await nextTick()

    expect(wrapper.emitted('mounted')).toEqual([[
      { hostId, projectId: 'project', pageId: 'home', revision: 'project:4:home:1' },
    ]])
    await wrapper.get('iframe').trigger('load')
    ;(wrapper.vm as unknown as { submit: () => void }).submit()
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        ...message,
        sequence: 2,
        type: 'submitResult',
        payload: { fields: flatFields('name'), requestId: `${hostId}:submit:1`, status: 'invalid', values: { name: '' }, touched: ['name'], validation: { name: ['Required'] } },
      },
      origin: window.location.origin,
      source,
    }))
    await nextTick()
    expect(wrapper.emitted('submitResult')).toEqual([[
      {
        hostId,
        projectId: 'project',
        pageId: 'home',
        revision: 'project:4:home:1',
        result: { fields: flatFields('name'), requestId: `${hostId}:submit:1`, status: 'invalid', values: { name: '' }, touched: ['name'], validation: { name: ['Required'] } },
      },
    ]])
    wrapper.unmount()
  })

  it('rejects stale identity, source, origin, and sequence before publishing runtime state', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const wrapper = mount(PreviewRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        compilation: {
          snapshotIdentity: { projectId: 'project', pageId: 'home' },
        } as PageCompilation,
        locale: 'en-US',
        runtimeState: { fields: flatFields(), values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
        revision: 'project:4:home:2',
        runtimeSessionKey: 'project:element-plus:home',
        title: 'Preview Runtime',
      },
    })
    const source = wrapper.get('iframe').element.contentWindow
    const current = {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: 'project',
      pageId: 'home',
      sequence: 1,
      revision: 'project:4:home:2',
      type: 'runtimeState',
      payload: { fields: flatFields('name'), values: { name: 'current' }, touched: [], validation: {} },
    }
    const dispatch = (data: Record<string, unknown>, options: {
      origin?: string
      source?: MessageEventSource | null
    } = {}): void => {
      window.dispatchEvent(new MessageEvent('message', {
        data,
        origin: options.origin ?? window.location.origin,
        source: options.source === undefined ? source : options.source,
      }))
    }

    dispatch({ ...current, sequence: 99, revision: 'project:4:home:1' })
    dispatch({ ...current, sequence: 100, hostId: 'old-host' })
    dispatch({ ...current, sequence: 101 }, { origin: 'https://foreign.test' })
    dispatch({ ...current, sequence: 102 }, { source: {} as MessageEventSource })
    dispatch(current)
    dispatch({ ...current, payload: { fields: flatFields('name'), values: { name: 'replayed' }, touched: [], validation: {} } })
    await nextTick()

    expect(wrapper.emitted('runtimeState')).toEqual([[
      {
        hostId,
        projectId: 'project',
        pageId: 'home',
        revision: 'project:4:home:2',
        state: { fields: flatFields('name'), values: { name: 'current' }, touched: [], validation: {} },
      },
    ]])
    wrapper.unmount()
  })

  it('uses one strictly increasing parent sequence for sync and submit', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const wrapper = mount(PreviewRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        compilation: {
          snapshotIdentity: { projectId: 'project', pageId: 'home' },
        } as PageCompilation,
        locale: 'en-US',
        runtimeState: { fields: flatFields(), values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
        revision: 'project:4:home:2',
        runtimeSessionKey: 'project:element-plus:home',
        title: 'Preview Runtime',
      },
    })
    const postMessage = vi.fn()
    Object.defineProperty(wrapper.get('iframe').element, 'contentWindow', {
      configurable: true,
      value: { postMessage },
    })

    await wrapper.get('iframe').trigger('load')
    ;(wrapper.vm as unknown as { submit: () => void }).submit()

    expect(postMessage.mock.calls.map(([message]) => {
      const value = message as { sequence: number, type: string }
      return { sequence: value.sequence, type: value.type }
    })).toEqual([
      { sequence: 1, type: 'sync' },
      { sequence: 2, type: 'submit' },
    ])
    await wrapper.setProps({ runtimeState: { fields: flatFields('name'), values: { name: 'mirror' }, touched: ['name'], validation: {} } })
    expect(postMessage).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
  it('correlates submit notifications and results and rejects same-revision stale request IDs', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const wrapper = mount(PreviewRuntimeHostFrame, { props: {
      adapter: 'element-plus',
      compilation: { snapshotIdentity: { projectId: 'project', pageId: 'home' } } as PageCompilation,
      locale: 'en-US',
      revision: 'rev',
      runtimeSessionKey: 'session',
      title: 'Preview',
      runtimeState: { fields: [], values: {}, touched: [], validation: {} },
      reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
    } })
    const source = { postMessage: vi.fn() } as unknown as Window
    Object.defineProperty(wrapper.get('iframe').element, 'contentWindow', { configurable: true, value: source })
    let sequence = 0
    const dispatch = (payload: Record<string, unknown>) => window.dispatchEvent(new MessageEvent('message', {
      source,
      origin: window.location.origin,
      data: { channel: RUNTIME_HOST_CHANNEL, version: RUNTIME_HOST_PROTOCOL_VERSION, hostId, projectId: 'project', pageId: 'home', revision: 'rev', sequence: ++sequence, ...payload },
    }))
    const result = (requestId: string, value = 'result') => ({ type: 'submitResult', payload: { requestId, status: 'success', fields: flatFields('name'), values: { name: value }, touched: [], validation: {} } })
    dispatch(result('unrequested'))
    expect(wrapper.emitted('submitResult')).toBeUndefined()
    await wrapper.get('iframe').trigger('load')
    const submit = () => (wrapper.vm as unknown as { submit: () => void }).submit()
    submit()
    const firstId = `${hostId}:submit:1`
    dispatch({ type: 'submit', requestId: firstId, values: { name: 'first' } })
    dispatch(result(firstId, 'first'))
    submit()
    const secondId = `${hostId}:submit:2`
    dispatch({ type: 'submit', requestId: firstId, values: { name: 'stale' } })
    dispatch(result(firstId, 'stale'))
    dispatch({ ...result(secondId), hostId: 'old-host' })
    dispatch({ ...result(secondId), revision: 'old-revision' })
    expect(wrapper.emitted('submitResult')).toHaveLength(1)
    dispatch({ type: 'submit', requestId: secondId, values: { name: 'second' } })
    dispatch({ type: 'submit', requestId: secondId, values: { name: 'duplicate' } })
    dispatch(result(secondId, 'second'))
    dispatch(result(secondId, 'replayed'))
    expect(wrapper.emitted('submitResult')).toHaveLength(2)
    expect(wrapper.emitted('submit')?.map(([event]) => event)).toEqual([
      expect.objectContaining({ phase: 'request', requestId: firstId }),
      expect.objectContaining({ phase: 'success', requestId: firstId, values: { name: 'first' } }),
      expect.objectContaining({ phase: 'request', requestId: secondId }),
      expect.objectContaining({ phase: 'success', requestId: secondId, values: { name: 'second' } }),
    ])
    const instance = { nodeId: 'child', scope: [{ scopeId: 'rows', rowId: 'row' }], instanceKey: 'opaque', valuePath: ['rows', 0, 'name'] }
    dispatch({ type: 'fieldChange', payload: { ...instance, field: 'name', values: { rows: [{ name: 'new' }] } } })
    expect(wrapper.emitted('fieldChange')).toEqual([[{ ...instance, field: 'name', values: { rows: [{ name: 'new' }] }, hostId, projectId: 'project', pageId: 'home', revision: 'rev' }]])
    wrapper.unmount()
  })
})

function flatFields(...names: string[]) {
  return names.map(nodeId => ({ nodeId, scope: [], instanceKey: nodeId, valuePath: [nodeId] }))
}
