// @vitest-environment happy-dom

import type { PageGraph } from '@moluoxixi/config-form-model'
import type { DesignerRuntimePointerHandlers } from '../src/components/DesignerCanvas/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  useDesignerCanvasMenu,
  useDesignerCanvasNodeDrag,
  useDesignerCanvasOverlayState,
  useDesignerCanvasResize,
  useDesignerCanvasSelection,
} from '../src/components/DesignerCanvas/composables'
import { createDesignerDragController } from '../src/components/DesignerCanvas/services'

const graph: PageGraph = {
  version: 2,
  form: { columns: 24, fieldSpan: 24 },
  props: {},
  root: [{ nodeId: 'field', placement: { span: 12 } }],
  nodesById: {
    field: {
      id: 'field',
      bindings: {},
      component: 'test.input',
      events: {},
      field: 'field',
      kind: 'field',
      props: {},
    },
  },
}

function mountInteractions() {
  const clearDragOverlay = vi.fn()
  const readonly = ref(false)
  const selectedIds = ref<string[]>([])
  const onResize = vi.fn()
  const onSelect = vi.fn()
  const publishOverlayMode = vi.fn()
  const runtimePointerHandlers: DesignerRuntimePointerHandlers = {}
  const sheetRef = ref<HTMLElement>()
  const dragController = createDesignerDragController({
    commitMaterial: vi.fn(),
    commitNode: vi.fn(),
  })
  dragController.registerKeyboardTargets(() => [{ parentId: null, index: 0 }])
  let interactions!: ReturnType<typeof useDesignerCanvasMenu>
    & ReturnType<typeof useDesignerCanvasNodeDrag>
    & ReturnType<typeof useDesignerCanvasOverlayState>
    & ReturnType<typeof useDesignerCanvasResize>
    & ReturnType<typeof useDesignerCanvasSelection>
  const Harness = defineComponent({
    setup() {
      const menu = useDesignerCanvasMenu({
        onAction: vi.fn(),
        readonly: () => readonly.value,
        selectedId: () => selectedIds.value[0],
        sheetRef,
      })
      const nodeDrag = useDesignerCanvasNodeDrag({
        activeSession: () => dragController.session.value,
        clearDragOverlay,
        closeNodeActionMenu: menu.closeNodeActionMenu,
        dragController,
        readonly: () => readonly.value,
        runtimeNodeGeometryById: () => undefined,
        stopCanvasAutoScroll: vi.fn(),
      })
      const selection = useDesignerCanvasSelection({
        beginNodeKeyboard: nodeDrag.beginNodeKeyboard,
        candidateId: () => dragController.session.value?.source.candidateId,
        focusNode: vi.fn(),
        handleActiveDragKeydown: nodeDrag.handleActiveDragKeydown,
        hitNodeElements: () => [],
        interactive: () => false,
        onAction: vi.fn(),
        onSelect,
        selectedId: () => selectedIds.value[0],
      })
      const resize = useDesignerCanvasResize({
        breakpoint: () => 'desktop',
        graph: () => graph,
        onResize,
        readonly: () => readonly.value,
        runtimeLayoutRect: () => ({ bottom: 100, height: 100, left: 0, right: 240, top: 0, width: 240 }),
        runtimePointerHandlers,
      })
      const overlayState = useDesignerCanvasOverlayState({
        activeSession: () => dragController.session.value,
        publishOverlayMode,
        resizingNodeId: resize.resizingNodeId,
        selectedSet: () => new Set(selectedIds.value),
      })
      interactions = { ...menu, ...nodeDrag, ...selection, ...resize, ...overlayState }
      return () => h('div')
    },
  })
  const wrapper = mount(Harness)
  return {
    clearDragOverlay,
    dragController,
    interactions,
    onResize,
    onSelect,
    publishOverlayMode,
    readonly,
    runtimePointerHandlers,
    selectedIds,
    sheetRef,
    wrapper,
  }
}

function pointerPayload(pointerId: number, clientX: number) {
  return {
    button: 0,
    clientX,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    pointerId,
    shiftKey: false,
  }
}

describe('designer canvas interactions', () => {
  it('publishes idle, selected, pointer-dragging, and keyboard-dragging overlay modes', async () => {
    const context = mountInteractions()
    expect(context.interactions.overlayMode.value).toBe('idle')

    context.selectedIds.value = ['field']
    await nextTick()
    expect(context.interactions.overlayMode.value).toBe('selected')

    context.dragController.beginNode('field', { x: 0, y: 0 })
    context.dragController.move({ x: 20, y: 20 })
    await nextTick()
    expect(context.interactions.overlayMode.value).toBe('pointer-dragging')

    context.dragController.cancel()
    context.dragController.beginNodeKeyboard('field')
    await nextTick()
    expect(context.interactions.overlayMode.value).toBe('keyboard-dragging')
    expect(context.publishOverlayMode).toHaveBeenLastCalledWith('keyboard-dragging')
    context.wrapper.unmount()
  })

  it('preserves pointer selection modifiers', () => {
    const context = mountInteractions()
    const node = document.createElement('div')
    node.dataset.configNodeId = 'field'
    node.addEventListener('pointerdown', context.interactions.handleCanvasPointerDown)

    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ctrlKey: true, pointerId: 1 }))
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, shiftKey: true }))

    expect(context.onSelect).toHaveBeenNthCalledWith(1, 'field', 'toggle')
    expect(context.onSelect).toHaveBeenNthCalledWith(2, 'field', 'range')
    context.wrapper.unmount()
  })

  it('focuses the first menu action and restores the trigger on Escape', async () => {
    const context = mountInteractions()
    const sheet = document.createElement('div')
    const trigger = document.createElement('button')
    trigger.dataset.nodeActionMenuTrigger = ''
    const menu = document.createElement('div')
    menu.dataset.nodeActionMenu = ''
    const item = document.createElement('button')
    item.setAttribute('role', 'menuitem')
    menu.append(item)
    sheet.append(trigger, menu)
    document.body.append(sheet)
    context.sheetRef.value = sheet

    await context.interactions.toggleNodeActionMenu('field')
    expect(document.activeElement).toBe(item)

    menu.addEventListener('keydown', context.interactions.handleNodeActionMenuKeydown)
    menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await nextTick()
    expect(context.interactions.nodeActionMenuNodeId.value).toBeUndefined()
    expect(document.activeElement).toBe(trigger)

    sheet.remove()
    context.wrapper.unmount()
  })

  it('commits pointer resize through both window and runtime-host channels', () => {
    const context = mountInteractions()
    const handle = document.createElement('button')
    handle.addEventListener('pointerdown', event => context.interactions.beginResize(event, 'field'))

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, pointerId: 11 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, pointerId: 11 }))
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, pointerId: 11 }))
    expect(context.onResize).toHaveBeenCalledWith('field', 24)
    expect(context.runtimePointerHandlers.move).toBeUndefined()

    context.onResize.mockClear()
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 120, pointerId: 12 }))
    context.runtimePointerHandlers.move?.(pointerPayload(12, 0))
    context.runtimePointerHandlers.cancel?.(pointerPayload(12, 0))
    expect(context.onResize).not.toHaveBeenCalled()
    expect(context.interactions.resizingNodeId.value).toBeUndefined()
    expect(context.runtimePointerHandlers.cancel).toBeUndefined()
    context.wrapper.unmount()
  })

  it('cancels node drag on lost pointer capture and readonly transition', async () => {
    const context = mountInteractions()
    const handle = document.createElement('button')
    const cancel = vi.spyOn(context.dragController, 'cancel')
    let capturedPointer: number | undefined
    handle.setPointerCapture = vi.fn(pointerId => capturedPointer = pointerId)
    handle.hasPointerCapture = vi.fn(pointerId => capturedPointer === pointerId)
    handle.releasePointerCapture = vi.fn((pointerId) => {
      if (capturedPointer === pointerId)
        capturedPointer = undefined
    })
    handle.addEventListener('pointerdown', event => context.interactions.beginNodeDrag(event, 'field'))

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 21 }))
    handle.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 21 }))
    expect(cancel).toHaveBeenCalledTimes(1)

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 22 }))
    context.readonly.value = true
    await nextTick()
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(context.clearDragOverlay).toHaveBeenCalledTimes(1)
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(22)
    context.wrapper.unmount()
  })

  it('clears resize handlers without committing on readonly and unmount', async () => {
    const context = mountInteractions()
    const handle = document.createElement('button')
    handle.addEventListener('pointerdown', event => context.interactions.beginResize(event, 'field'))

    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, pointerId: 31 }))
    expect(context.runtimePointerHandlers.move).toBeTypeOf('function')
    context.readonly.value = true
    await nextTick()
    expect(context.runtimePointerHandlers.move).toBeUndefined()
    expect(context.onResize).not.toHaveBeenCalled()

    context.readonly.value = false
    await nextTick()
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, pointerId: 32 }))
    context.runtimePointerHandlers.move?.(pointerPayload(32, 120))
    expect(context.runtimePointerHandlers.up).toBeTypeOf('function')
    context.wrapper.unmount()
    expect(context.runtimePointerHandlers.up).toBeUndefined()
    expect(context.onResize).not.toHaveBeenCalled()
  })
})
