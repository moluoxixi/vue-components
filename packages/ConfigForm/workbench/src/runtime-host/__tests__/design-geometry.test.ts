// @vitest-environment happy-dom

import type { ConfigFormRendererNode, ConfigFormRuntimeNodeMetadata } from '@moluoxixi/config-form'
import type { RuntimeHostToParentPayload } from '../types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useRuntimeHostDesignGeometry } from '../composables'

const wrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('runtime host design geometry', () => {
  it('owns registered node geometry, pointer hit testing, and observer cleanup', async () => {
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class ResizeObserver {
      disconnect = disconnect
      observe = observe
      unobserve = unobserve
    })
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(640)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(480)
    vi.spyOn(document.body, 'scrollHeight', 'get').mockReturnValue(480)
    const messages: RuntimeHostToParentPayload[] = []
    let geometry!: ReturnType<typeof useRuntimeHostDesignGeometry>
    const wrapper = mount(defineComponent({
      setup() {
        geometry = useRuntimeHostDesignGeometry({
          design: ref({ breakpoint: 'desktop', variant: 'canvas' }),
          postMessage: message => messages.push(message),
          runtimeMode: ref('design'),
        })
        return geometry
      },
      template: '<main ref="stage"><form></form></main>',
    }))
    wrappers.push(wrapper)
    const stage = wrapper.get('main').element
    const form = wrapper.get('form').element
    const node = document.createElement('button')
    stage.append(node)
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 500, 400))
    vi.spyOn(form, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 300, 200))
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(30, 40, 100, 50))
    const metadata: ConfigFormRuntimeNodeMetadata<Record<string, unknown>> = {
      component: 'element.button',
      kind: 'component',
      mode: 'design',
      node: {
        id: 'submit',
        component: 'element.button',
        props: {},
      } as ConfigFormRendererNode<Record<string, unknown>>,
      nodeId: 'submit',
      path: 'root.0',
    }
    const unregister = geometry.designEditor.registerNode?.(metadata, node)
    if (typeof unregister !== 'function')
      throw new Error('Expected a design node disposer.')

    await geometry.sync()

    const geometryMessage = messages.find((message): message is Extract<RuntimeHostToParentPayload, { type: 'geometry' }> => message.type === 'geometry')
    expect(geometryMessage?.payload).toMatchObject({
      nodes: [{ depth: 2, nodeId: 'submit', order: 0, path: 'root.0' }],
      surfaceRect: { left: 10, top: 20, width: 300, height: 200 },
      viewport: { height: 480, width: 640 },
    })
    geometry.postDesignPointer('designPointerMove', pointer(50, 60))
    const pointerMessage = messages.find(message => message.type === 'designPointerMove')
    if (!pointerMessage || pointerMessage.type !== 'designPointerMove')
      throw new Error('Expected a design pointer message.')
    expect(pointerMessage.payload).toMatchObject({ clientX: 50, clientY: 60, nodeId: 'submit', pointerId: 7 })

    unregister()
    await geometry.sync()
    const latestGeometry = messages
      .filter((message): message is Extract<RuntimeHostToParentPayload, { type: 'geometry' }> => message.type === 'geometry')
      .at(-1)
    expect(latestGeometry?.payload.nodes).toEqual([])
    expect(unobserve).toHaveBeenCalledWith(node)

    const messageCount = messages.length
    wrapper.unmount()
    wrappers.pop()
    window.dispatchEvent(new Event('resize'))
    expect(messages).toHaveLength(messageCount)
    expect(disconnect).toHaveBeenCalledOnce()
  })
})

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

function pointer(clientX: number, clientY: number): PointerEvent {
  return new PointerEvent('pointermove', {
    button: 0,
    clientX,
    clientY,
    ctrlKey: false,
    metaKey: false,
    pointerId: 7,
    shiftKey: false,
  })
}
