// @vitest-environment happy-dom

import type { PageGraph } from '@moluoxixi/config-form-model'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { compile } from 'sass'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { DesignerCanvas } from '../src/components/DesignerCanvas'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry({ materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'Input',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({ id, field, kind: 'field', component: 'test.input' }),
}] })

const emptyGraph: PageGraph = {
  version: 2,
  form: {},
  props: {},
  root: [],
  nodesById: {},
}

const populatedGraph: PageGraph = {
  ...emptyGraph,
  root: [{ nodeId: 'field', placement: {} }],
  nodesById: {
    field: {
      id: 'field',
      component: 'test.input',
      kind: 'field',
      field: 'field',
      props: {},
      events: {},
      bindings: {},
    },
  },
}

function mountCanvas(graph: PageGraph = emptyGraph) {
  return mount(DesignerCanvas, {
    props: {
      candidatePreview: () => undefined,
      graph,
      pageId: 'home',
      registry,
      runtimeRenderer: { fields: [] },
    },
    slots: {
      runtime: '<div data-test-runtime />',
    },
  })
}

describe('designer canvas presentation', () => {
  it('describes an empty projected graph with a non-interactive overlay', async () => {
    const wrapper = mountCanvas()
    const canvas = wrapper.get('.mx-config-form-designer__canvas')
    const empty = wrapper.get('.mx-config-form-designer__canvas-empty')
    expect(empty.text()).toBe('Drag or click a component on the left to add a field')
    expect(canvas.attributes('aria-describedby')).toBe(empty.attributes('id'))

    await wrapper.setProps({ graph: populatedGraph })
    expect(wrapper.find('.mx-config-form-designer__canvas-empty').exists()).toBe(false)
    expect(canvas.attributes('aria-describedby')).toBeUndefined()

    const stylesheet = compile(
      resolve(process.cwd(), 'src/components/DesignerCanvas/style/index.scss'),
      { loadPaths: [resolve(process.cwd(), 'node_modules')] },
    ).css
    const emptyRule = stylesheet.match(/\.mx-config-form-designer__canvas-empty\s*\{([^}]+)\}/)?.[1]
    expect(emptyRule).toContain('position: absolute;')
    expect(emptyRule).toContain('pointer-events: none;')
    expect(emptyRule).not.toContain('min-height')
  })

  it('exposes real camera shortcuts and keeps the control at the lower right', () => {
    const wrapper = mountCanvas()
    expect(wrapper.get('button[aria-label="Zoom out"]').attributes('aria-keyshortcuts')).toBe('-')
    expect(wrapper.get('button[aria-label="Actual size"]').attributes('aria-keyshortcuts')).toBe('0')
    expect(wrapper.get('button[aria-label="Zoom in"]').attributes('aria-keyshortcuts')).toBe('Shift+=')
    expect(wrapper.get('button[aria-label="Fit canvas"]').attributes('aria-keyshortcuts')).toBe('Shift+1')

    const stylesheet = compile(
      resolve(process.cwd(), 'src/components/DesignerCanvas/style/index.scss'),
      { loadPaths: [resolve(process.cwd(), 'node_modules')] },
    ).css
    const cameraRule = stylesheet.match(/\.mx-config-form-designer__camera-controls\s*\{([^}]+)\}/)?.[1]
    expect(cameraRule).toContain('right: 14px;')
    expect(cameraRule).toContain('bottom: 14px;')
    expect(cameraRule).not.toContain('left: 50%')
  })

  it('steps camera controls and isolates shortcuts from editable controls', async () => {
    const wrapper = mountCanvas()
    const canvas = wrapper.get('.mx-config-form-designer__canvas')
    const percent = () => wrapper.get('button[aria-label="Actual size"]').text()

    expect(percent()).toBe('100%')
    await wrapper.get('button[aria-label="Zoom out"]').trigger('click')
    expect(percent()).toBe('80%')
    await wrapper.get('button[aria-label="Zoom in"]').trigger('click')
    expect(percent()).toBe('100%')

    await canvas.trigger('pointerenter')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Minus', key: '-' }))
    await nextTick()
    expect(percent()).toBe('80%')

    const input = document.createElement('input')
    document.body.append(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'Equal', key: '+' }))
    await nextTick()
    expect(percent()).toBe('80%')
    input.remove()

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0', key: '0' }))
    await nextTick()
    expect(percent()).toBe('100%')
  })

  it('pans the viewport while Space is held and cleans pointer state on release', async () => {
    const wrapper = mountCanvas()
    const canvas = wrapper.get('.mx-config-form-designer__canvas')
    const viewport = wrapper.get<HTMLElement>('[data-canvas-camera-viewport]')
    viewport.element.scrollLeft = 40
    viewport.element.scrollTop = 30
    await canvas.trigger('pointerenter')

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))
    await nextTick()
    const gesture = wrapper.get('.mx-config-form-designer__camera-gesture-layer')
    await gesture.trigger('pointerdown', { button: 0, clientX: 100, clientY: 100, pointerId: 21 })
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 70, pointerId: 21 }))
    expect(viewport.element.scrollLeft).toBe(60)
    expect(viewport.element.scrollTop).toBe(60)
    expect(gesture.classes()).toContain('is-panning')

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 21 }))
    await nextTick()
    expect(gesture.classes()).not.toContain('is-panning')

    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }))
    await nextTick()
    expect(wrapper.find('.mx-config-form-designer__camera-gesture-layer').exists()).toBe(false)
  })

  it('ends camera pan on lost capture and releases capture on unmount', async () => {
    const wrapper = mountCanvas()
    const canvas = wrapper.get('.mx-config-form-designer__canvas')
    await canvas.trigger('pointerenter')
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))
    await nextTick()
    const gesture = wrapper.get<HTMLElement>('.mx-config-form-designer__camera-gesture-layer')
    let capturedPointer: number | undefined
    gesture.element.setPointerCapture = pointerId => capturedPointer = pointerId
    gesture.element.hasPointerCapture = pointerId => capturedPointer === pointerId
    const releasePointerCapture = vi.fn((pointerId: number) => {
      if (capturedPointer === pointerId)
        capturedPointer = undefined
    })
    gesture.element.releasePointerCapture = releasePointerCapture

    await gesture.trigger('pointerdown', { button: 0, pointerId: 31 })
    expect(gesture.classes()).toContain('is-panning')
    gesture.element.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 31 }))
    await nextTick()
    expect(gesture.classes()).not.toContain('is-panning')
    expect(releasePointerCapture).toHaveBeenCalledWith(31)

    await gesture.trigger('pointerdown', { button: 0, pointerId: 32 })
    expect(gesture.classes()).toContain('is-panning')
    wrapper.unmount()
    expect(releasePointerCapture).toHaveBeenCalledWith(32)
  })
})
