// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useDesignSurfaceWorkspace } from '../src/components/DesignSurface/composables'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('design surface workspace', () => {
  it('preserves external canvas navigation while migrating focus and releases observers', async () => {
    let observerCallback!: ResizeObserverCallback
    const observe = vi.fn()
    const disconnect = vi.fn()
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback
      }

      observe = observe
      disconnect = disconnect
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    let workspace!: ReturnType<typeof useDesignSurfaceWorkspace>
    const Harness = defineComponent({
      setup() {
        workspace = useDesignSurfaceWorkspace({ navigation: () => 'external' })
        return () => h('div', {
          ref: workspace.rootRef,
          onFocusin: workspace.handleRootFocusin,
        }, [
          h('button', { 'data-sidebar-trigger': 'properties' }),
          h('div', { 'data-workspace-panel': 'canvas', 'tabindex': -1 }),
          h('div', { 'data-workspace-panel': 'properties' }, [
            h('button', { 'data-test': 'property-control' }),
          ]),
        ])
      },
    })
    const wrapper = mount(Harness, { attachTo: document.body })
    let width = 900
    wrapper.element.getBoundingClientRect = () => ({ width }) as DOMRect
    observerCallback([], {} as ResizeObserver)
    await nextTick()
    expect(workspace.workspaceMode.value).toBe('medium')
    expect(observe).toHaveBeenCalledWith(wrapper.element)

    workspace.toggleWorkspacePanel('properties')
    const propertyControl = wrapper.get<HTMLButtonElement>('[data-test="property-control"]')
    propertyControl.element.focus()
    await propertyControl.trigger('focusin')
    expect(document.activeElement).toBe(propertyControl.element)

    width = 600
    observerCallback([], {} as ResizeObserver)
    await nextTick()
    expect(workspace.workspaceMode.value).toBe('narrow')
    expect(workspace.activeWorkspaceView.value).toBe('canvas')
    expect(document.activeElement).toBe(wrapper.get('[data-workspace-panel="canvas"]').element)

    const resizeRegistration = addEventListener.mock.calls.find(([event]) => event === 'resize')
    expect(resizeRegistration).toBeDefined()
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(removeEventListener).toHaveBeenCalledWith('resize', resizeRegistration?.[1])
  })
})
