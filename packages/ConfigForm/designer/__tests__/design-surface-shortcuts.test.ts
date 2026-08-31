// @vitest-environment happy-dom

import type { PageGraph, ProjectCommand } from '@moluoxixi/config-form-model'
import type { DesignSurfaceExpose } from '../src/components/types'
import { createComponentContractRegistry } from '@moluoxixi/config-form-model'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import DesignSurface from '../src/components/DesignSurface.vue'
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
const componentRegistry = createComponentContractRegistry([{
  key: 'test.input',
  version: '1',
  kind: 'field',
  props: [],
  events: [],
  bindings: [],
  slots: [],
  allowedParents: [],
  defaults: {},
}], { adapter: 'test', version: '1' })
const graph: PageGraph = {
  version: 2,
  props: {},
  form: {},
  root: [
    { nodeId: 'first', placement: {} },
    { nodeId: 'second', placement: {} },
  ],
  nodesById: {
    first: {
      id: 'first',
      component: 'test.input',
      kind: 'field',
      field: 'first',
      props: {},
      events: {},
      bindings: {},
    },
    second: {
      id: 'second',
      component: 'test.input',
      kind: 'field',
      field: 'second',
      props: {},
      events: {},
      bindings: {},
    },
  },
}

function mountSurface() {
  const execute = vi.fn((_command: ProjectCommand) => ({ changed: true, diagnostics: [] }))
  const undo = vi.fn(() => true)
  const redo = vi.fn(() => true)
  const wrapper = mount(DesignSurface, {
    props: {
      commandControl: { execute, preview: () => undefined },
      componentRegistry,
      graph,
      historyControl: {
        canRedo: true,
        canUndo: true,
        history: { entries: [], limit: 100, position: 0 },
        redo,
        undo,
      },
      pageId: 'home',
      registry,
      runtimeRenderer: { fields: [] },
    },
    slots: {
      properties: () => h('button', { 'data-test': 'setter-button' }, 'Setter action'),
      toolbar: () => h('div', [
        h('input', { 'data-test': 'text-editor' }),
        h('textarea', { 'data-test': 'textarea-editor' }),
        h('select', { 'data-test': 'select-editor' }, [
          h('option', { 'data-test': 'option-editor' }, 'Option'),
        ]),
        h('div', { 'contenteditable': 'true', 'data-test': 'content-editor' }),
      ]),
    },
  })
  return { execute, redo, undo, wrapper }
}

describe('design surface editing shortcuts', () => {
  it('routes multi-selection duplicate and delete through one command each', async () => {
    const { execute, undo, wrapper } = mountSurface()
    const surface = wrapper.vm as unknown as DesignSurfaceExpose
    surface.select('first')
    surface.select('second', 'toggle')

    await wrapper.get('.mx-config-form-design-surface').trigger('keydown', { ctrlKey: true, key: 'd' })
    const duplicate = execute.mock.calls[0]![0]
    expect(duplicate.label).toBe('Duplicate components')
    expect(duplicate.actions).toHaveLength(2)

    surface.select('first')
    surface.select('second', 'toggle')
    await wrapper.get('.mx-config-form-design-surface').trigger('keydown', { key: 'Delete' })
    const remove = execute.mock.calls[1]![0]
    expect(remove.label).toBe('Remove components')
    expect(remove.actions).toHaveLength(1)
    expect(remove.actions[0]).toMatchObject({
      operations: [
        { type: 'node.remove', nodeId: 'first' },
        { type: 'node.remove', nodeId: 'second' },
      ],
    })

    await wrapper.setProps({
      historyControl: {
        canRedo: false,
        canUndo: true,
        history: {
          entries: [{ id: remove.id, label: remove.label, editVersion: 1, timestamp: 1 }],
          limit: 100,
          position: 1,
        },
        redo: vi.fn(() => false),
        undo,
      },
    })
    const undoNotice = wrapper.emitted('notice')?.at(-1)?.[1] as (() => boolean)
    expect(undoNotice()).toBe(true)
    expect(undo).toHaveBeenCalledOnce()

    await wrapper.setProps({
      historyControl: {
        canRedo: false,
        canUndo: true,
        history: {
          entries: [{ id: 'later-command', label: 'Later command', editVersion: 2, timestamp: 2 }],
          limit: 1,
          position: 1,
        },
        redo: vi.fn(() => false),
        undo,
      },
    })
    expect(undoNotice()).toBe(false)
    expect(undo).toHaveBeenCalledOnce()
  })

  it('invalidates a deletion notice after any intervening undo or redo transition', async () => {
    const { execute, redo, undo, wrapper } = mountSurface()
    const surface = wrapper.vm as unknown as DesignSurfaceExpose
    surface.select('first')
    await wrapper.get('.mx-config-form-design-surface').trigger('keydown', { key: 'Delete' })
    const removeCommand = execute.mock.calls[0]![0]
    const remove = wrapper.emitted('notice')?.at(-1)
    const undoNotice = remove?.[1] as (() => boolean)

    await wrapper.setProps({
      historyControl: {
        canRedo: true,
        canUndo: true,
        history: {
          entries: [{ id: removeCommand.id, label: 'Remove component', editVersion: 1, timestamp: 1 }],
          limit: 100,
          position: 1,
        },
        redo,
        undo,
      },
    })
    await wrapper.get('.mx-config-form-design-surface').trigger('keydown', { ctrlKey: true, key: 'z' })
    await wrapper.get('.mx-config-form-design-surface').trigger('keydown', { ctrlKey: true, key: 'y' })

    undo.mockClear()
    expect(undoNotice()).toBe(false)
    expect(undo).not.toHaveBeenCalled()
  })

  it('supports platform undo/redo shortcuts and ignores text editing targets', async () => {
    const { execute, redo, undo, wrapper } = mountSurface()
    const surface = wrapper.vm as unknown as DesignSurfaceExpose
    surface.select('first')
    const root = wrapper.get('.mx-config-form-design-surface')

    await root.trigger('keydown', { metaKey: true, key: 'z' })
    await root.trigger('keydown', { ctrlKey: true, key: 'z' })
    await root.trigger('keydown', { ctrlKey: true, shiftKey: true, key: 'z' })
    await root.trigger('keydown', { metaKey: true, shiftKey: true, key: 'z' })
    await root.trigger('keydown', { ctrlKey: true, key: 'y' })
    expect(undo).toHaveBeenCalledTimes(2)
    expect(redo).toHaveBeenCalledTimes(3)

    for (const selector of [
      '[data-test="text-editor"]',
      '[data-test="textarea-editor"]',
      '[data-test="select-editor"]',
      '[data-test="option-editor"]',
      '[data-test="content-editor"]',
      '[data-test="setter-button"]',
    ]) {
      const target = wrapper.get(selector)
      await target.trigger('keydown', { ctrlKey: true, key: 'd' })
      await target.trigger('keydown', { key: 'Backspace' })
    }
    await root.trigger('keydown', { isComposing: true, key: 'Delete' })
    const prevented = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Delete' })
    prevented.preventDefault()
    root.element.dispatchEvent(prevented)
    expect(execute).not.toHaveBeenCalled()

    await root.trigger('keydown', { key: 'd', metaKey: true })
    expect(execute).toHaveBeenCalledOnce()
    execute.mockClear()
    await root.trigger('keydown', { altKey: true, ctrlKey: true, key: 'd' })
    expect(execute).not.toHaveBeenCalled()

    await wrapper.setProps({ readonly: true })
    await root.trigger('keydown', { metaKey: true, key: 'd' })
    await root.trigger('keydown', { key: 'Delete' })
    expect(execute).not.toHaveBeenCalled()
  })
})
