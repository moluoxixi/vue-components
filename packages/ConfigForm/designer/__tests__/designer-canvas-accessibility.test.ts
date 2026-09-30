// @vitest-environment happy-dom

import type { ConfigFormBreakpoint, DesignerRuntimeHostBridge, DesignerRuntimeSlotScope } from '../src/components/DesignerCanvas/types'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { DesignerCanvas } from '../src/components/DesignerCanvas'
import { createDesignerRegistry } from '../src/registry'

function rect(left: number, top: number, width: number, height: number) {
  return { bottom: top + height, height, left, right: left + width, top, width }
}

function mountSelectedCanvas(span = 12, breakpoint: ConfigFormBreakpoint = 'desktop') {
  let bridge!: DesignerRuntimeHostBridge
  const wrapper = mount(DesignerCanvas, {
    attachTo: document.body,
    props: {
      breakpoint,
      candidatePreview: () => undefined,
      graph: {
        version: SURFACE_GRAPH_VERSION,
        form: { columns: 24, fieldSpan: 24, responsive: { mobile: { columns: 4 } } },
        props: {},
        root: [{ nodeId: 'field', placement: { span } }],
        nodesById: {
          field: { id: 'field', component: 'test.input', datasetBindings: {}, field: 'field', kind: 'field', props: {} },
        },
      },
      registry: createDesignerRegistry({ materials: [] }),
      selectedId: 'field',
      surfaceId: 'home',
    },
    slots: {
      runtime: (scope: DesignerRuntimeSlotScope) => {
        bridge = scope.bridge
        return h('div', { 'data-runtime': '' })
      },
    },
  })
  bridge.updateGeometry({
    layoutRect: rect(0, 0, 300, 400),
    nodes: [{ depth: 0, nodeId: 'field', order: 0, path: 'field', rect: rect(10, 20, 150, 60) }],
    revision: 'test',
    surfaceRect: rect(0, 0, 300, 400),
    viewport: { height: 400, width: 300 },
  })
  return { bridge, wrapper }
}

function openContextMenu(bridge: DesignerRuntimeHostBridge) {
  bridge.contextMenu({
    button: 2,
    clientX: 50,
    clientY: 60,
    ctrlKey: false,
    metaKey: false,
    nodeId: 'field',
    pointerId: 1,
    shiftKey: false,
  })
}

describe('designer canvas accessibility wiring', () => {
  it('routes resize keys through the overlay without moving the node and removes readonly controls', async () => {
    const { wrapper } = mountSelectedCanvas()
    await nextTick()
    const handle = wrapper.get('.mx-config-form-designer__resize-handle')
    expect(handle.attributes('aria-keyshortcuts')).toBe('ArrowLeft ArrowRight')
    await handle.trigger('keydown', { key: 'ArrowLeft' })
    await handle.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('resize')).toEqual([['field', 11], ['field', 13]])
    expect(wrapper.emitted('action')).toBeUndefined()

    await wrapper.setProps({ readonly: true })
    expect(wrapper.find('.mx-config-form-designer__resize-handle').exists()).toBe(false)
    expect(wrapper.findAll('[data-node-toolbar-button]').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
  })

  it.each([
    [1, 'desktop', 'ArrowLeft', undefined],
    [24, 'desktop', 'ArrowRight', undefined],
    [12, 'mobile', 'ArrowLeft', 3],
    [12, 'mobile', 'ArrowRight', undefined],
  ] as const)('resizes span %i at %s with %s from the visible grid width', async (span, breakpoint, key, expected) => {
    const { wrapper } = mountSelectedCanvas(span, breakpoint)
    await nextTick()
    await wrapper.get('.mx-config-form-designer__resize-handle').trigger('keydown', { key })
    expect(wrapper.emitted('resize')).toEqual(expected === undefined ? undefined : [['field', expected]])
    wrapper.unmount()
  })

  it('restores selection focus on Escape and preserves outside focus on pointer dismissal', async () => {
    const { bridge, wrapper } = mountSelectedCanvas()
    openContextMenu(bridge)
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-designer-context-menu] [role="menuitem"]').element)
    const menu = wrapper.get('[data-designer-context-menu]')
    const enabled = menu.findAll('[role="menuitem"]:not(:disabled)')
    await menu.trigger('keydown', { key: 'ArrowDown' })
    await menu.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(enabled[2]!.element)
    await menu.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(enabled.at(-1)!.element)
    await wrapper.get('[data-designer-context-menu]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[data-designer-context-menu]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-editor-focus-node-id="field"]').element)

    openContextMenu(bridge)
    await nextTick()
    await nextTick()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-designer-context-menu]').exists()).toBe(false)
    expect(document.activeElement).toBe(outside)
    outside.remove()
    wrapper.unmount()
  })

  it('repositions an open context menu when the viewport shrinks', async () => {
    const width = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    const height = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768)
    const { bridge, wrapper } = mountSelectedCanvas()
    openContextMenu(bridge)
    await nextTick()
    const menu = wrapper.get<HTMLElement>('[data-designer-context-menu]')
    expect(menu.element.style.left).toBe('50px')
    expect(menu.element.style.top).toBe('60px')

    width.mockReturnValue(210)
    height.mockReturnValue(340)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(menu.element.style.left).toBe('10px')
    expect(menu.element.style.top).toBe('18px')
    wrapper.unmount()
    width.mockRestore()
    height.mockRestore()
  })
})
