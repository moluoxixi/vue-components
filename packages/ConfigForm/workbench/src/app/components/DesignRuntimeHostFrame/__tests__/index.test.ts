// @vitest-environment happy-dom

import type { PageCompilation } from '@moluoxixi/config-form-compiler'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  RUNTIME_HOST_CHANNEL,
  RUNTIME_HOST_PROTOCOL_VERSION,
} from '../../../../runtime-host'
import DesignRuntimeHostFrame from '../index.vue'

const hostId = '11111111-1111-4111-8111-111111111111'
let mountedWrapper: VueWrapper | undefined

afterEach(() => {
  mountedWrapper?.unmount()
  mountedWrapper = undefined
  vi.restoreAllMocks()
})

describe('design RuntimeHost frame', () => {
  it('maps geometry and pointer coordinates while rejecting stale or replayed messages', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(hostId)
    const compilation = {
      key: { pageId: 'home', semanticHash: 'page-hash' },
      snapshotIdentity: { pageId: 'home', projectId: 'project' },
    } as PageCompilation
    const revision = `project:home:${JSON.stringify(compilation.key)}`
    const wrapper = mount(DesignRuntimeHostFrame, {
      props: {
        adapter: 'element-plus',
        breakpoint: 'desktop',
        cameraScale: 1,
        locale: 'en-US',
        modelValue: {},
        reactionProps: {},
        reactionStates: {},
        resolveCompilation: () => compilation,
        title: 'Design Runtime',
        variant: 'canvas',
      },
    })
    mountedWrapper = wrapper
    const frame = wrapper.get('iframe').element
    const source = frame.contentWindow
    Object.defineProperties(frame, {
      clientHeight: { configurable: true, value: 100 },
      clientWidth: { configurable: true, value: 200 },
    })
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({
      bottom: 250,
      height: 200,
      left: 100,
      right: 500,
      top: 50,
      width: 400,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    })

    const geometry = {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      pageId: 'home',
      projectId: 'project',
      revision,
      sequence: 1,
      type: 'geometry',
      payload: {
        layoutRect: { bottom: 45, height: 40, left: 20, right: 100, top: 5, width: 80 },
        nodes: [{
          depth: 0,
          nodeId: 'name',
          order: 0,
          path: 'fields.0',
          rect: { bottom: 35, height: 20, left: 30, right: 90, top: 15, width: 60 },
        }],
        surfaceRect: { bottom: 55, height: 50, left: 10, right: 110, top: 5, width: 100 },
        viewport: { height: 200.2, width: 320 },
      },
    }
    window.dispatchEvent(new MessageEvent('message', {
      data: geometry,
      origin: window.location.origin,
      source,
    }))
    await nextTick()
    await nextTick()

    expect(wrapper.get('iframe').attributes('style')).toContain('height: 201px')
    expect(wrapper.emitted('geometry')).toEqual([[
      {
        layoutRect: { bottom: 140, height: 80, left: 140, right: 300, top: 60, width: 160 },
        nodes: [{
          depth: 0,
          nodeId: 'name',
          order: 0,
          path: 'fields.0',
          rect: { bottom: 120, height: 40, left: 160, right: 280, top: 80, width: 120 },
        }],
        revision,
        surfaceRect: { bottom: 160, height: 100, left: 120, right: 320, top: 60, width: 200 },
        viewport: { height: 200.2, width: 320 },
      },
    ]])

    const pointer = {
      channel: RUNTIME_HOST_CHANNEL,
      version: RUNTIME_HOST_PROTOCOL_VERSION,
      hostId,
      pageId: 'home',
      projectId: 'project',
      revision,
      sequence: 2,
      type: 'designPointerMove',
      payload: {
        button: 0,
        clientX: 15,
        clientY: 20,
        ctrlKey: false,
        metaKey: false,
        nodeId: 'name',
        pointerId: 4,
        shiftKey: false,
      },
    }
    window.dispatchEvent(new MessageEvent('message', {
      data: { ...pointer, revision: 'stale-revision' },
      origin: window.location.origin,
      source,
    }))
    window.dispatchEvent(new MessageEvent('message', {
      data: pointer,
      origin: window.location.origin,
      source,
    }))
    window.dispatchEvent(new MessageEvent('message', {
      data: pointer,
      origin: window.location.origin,
      source,
    }))
    await nextTick()

    expect(wrapper.emitted('pointerMove')).toEqual([[
      {
        ...pointer.payload,
        clientX: 130,
        clientY: 90,
      },
    ]])
    wrapper.unmount()
    mountedWrapper = undefined
  })
})
