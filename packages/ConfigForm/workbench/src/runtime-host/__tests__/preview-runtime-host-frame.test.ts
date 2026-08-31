// @vitest-environment happy-dom

import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import PreviewRuntimeHostFrame from '../PreviewRuntimeHostFrame.vue'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../protocol'

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
        runtimeState: { values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
        revision: 'project:4:home:1',
        runtimeSessionKey: 'project:element-plus:home',
        title: 'Preview Runtime',
      },
    })
    const source = wrapper.get('iframe').element.contentWindow
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
    wrapper.unmount()
  })

  it('rejects messages from stale revisions before publishing runtime state', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const wrapper = mount(PreviewRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        compilation: {
          snapshotIdentity: { projectId: 'project', pageId: 'home' },
        } as PageCompilation,
        locale: 'en-US',
        runtimeState: { values: {}, touched: [], validation: {} },
        reactionProjection: { values: {}, props: {}, states: {}, validate: [] },
        revision: 'project:4:home:2',
        runtimeSessionKey: 'project:element-plus:home',
        title: 'Preview Runtime',
      },
    })
    const source = wrapper.get('iframe').element.contentWindow
    const payload = {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      projectId: 'project',
      pageId: 'home',
      sequence: 1,
      revision: 'project:4:home:1',
      type: 'runtimeState',
      payload: { values: { name: 'stale' }, touched: [], validation: {} },
    }

    window.dispatchEvent(new MessageEvent('message', {
      data: payload,
      origin: window.location.origin,
      source,
    }))
    await nextTick()

    expect(wrapper.emitted('runtimeState')).toBeUndefined()
    wrapper.unmount()
  })
})
