// @vitest-environment happy-dom

import type { PageGraph } from '@moluoxixi/config-form-model'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DesignerCanvas from '../src/components/DesignerCanvas.vue'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry([{ name: 'test', materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'Input',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({ id, field, kind: 'field', component: 'test.input' }),
}] }])

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

    const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8')
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

    const stylesheet = readFileSync(resolve(process.cwd(), 'src/styles.scss'), 'utf8')
    const cameraRule = stylesheet.match(/\.mx-config-form-designer__camera-controls\s*\{([^}]+)\}/)?.[1]
    expect(cameraRule).toContain('right: 14px;')
    expect(cameraRule).toContain('bottom: 14px;')
    expect(cameraRule).not.toContain('left: 50%')
  })
})
