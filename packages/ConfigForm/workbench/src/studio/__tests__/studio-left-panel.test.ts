// @vitest-environment happy-dom

import type { WorkspaceApplication } from '../../project'
import { createDesignerRegistry } from '@moluoxixi/config-form-designer'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StudioLeftPanel from '../StudioLeftPanel.vue'

const registry = createDesignerRegistry([{ name: 'test', materials: [{
  key: 'test.input',
  version: 1,
  kind: 'field',
  category: 'Fields',
  title: 'Input',
  runtime: { component: 'input' },
  source: { configComponent: 'text', render: 'component', tag: 'input' },
  setters: [],
  createNode: ({ id, field = 'input' }) => ({ id, field, kind: 'field', material: 'test.input' }),
}] }])

const application = {
  id: 'app',
  pages: [
    { id: 'page-a', name: 'Page A', route: '/a' },
    { id: 'page-b', name: 'Page B', route: '/b' },
  ],
} as WorkspaceApplication

describe('studio left panel', () => {
  it('owns only view state and emits semantic layer and page commands', async () => {
    const wrapper = mount(StudioLeftPanel, {
      props: {
        application,
        currentPageId: 'page-a',
        form: {},
        layers: [{ id: 'field', label: 'Name', component: 'test.input', depth: 1 }],
        materials: registry.listMaterials(),
        registry,
        selectedIds: ['field'],
      },
    })

    await wrapper.get('[data-designer-left-tab="layers"]').trigger('click')
    const layer = wrapper.get('[role="treeitem"]')
    expect(layer.attributes('aria-selected')).toBe('true')
    await layer.get('.designer-layer-select').trigger('click', { ctrlKey: true })
    await layer.findAll('.designer-layer-actions button')[0]!.trigger('click')
    expect(wrapper.emitted('selectLayer')).toEqual([['field', 'toggle']])
    expect(wrapper.emitted('arrangeLayer')).toEqual([['moveBefore', 'field']])

    await wrapper.get('[data-designer-left-tab="pages"]').trigger('click')
    await wrapper.findAll('.designer-pages button')[1]!.trigger('click')
    await wrapper.get('.manage-pages-button').trigger('click')
    expect(wrapper.emitted('selectPage')).toEqual([['page-b']])
    expect(wrapper.emitted('managePages')).toHaveLength(1)
  })

  it('implements roving keyboard focus for the three views', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        application,
        currentPageId: 'page-a',
        form: {},
        layers: [],
        materials: registry.listMaterials(),
        registry,
        selectedIds: [],
      },
    })

    const components = wrapper.get('[data-designer-left-tab="components"]')
    ;(components.element as HTMLButtonElement).focus()
    await components.trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(wrapper.get('[data-designer-left-tab="pages"]').element)
    wrapper.unmount()
  })

  it('provides keyboard selection and arrangement paths for layers and pages', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        application,
        currentPageId: 'page-a',
        form: {},
        layers: [
          { id: 'field-a', label: 'First', component: 'test.input', depth: 0 },
          { id: 'field-b', label: 'Second', component: 'test.input', depth: 1 },
        ],
        materials: registry.listMaterials(),
        registry,
        selectedIds: ['field-a'],
      },
    })

    await wrapper.get('[data-designer-left-tab="layers"]').trigger('click')
    const firstLayer = wrapper.get('[data-layer-id="field-a"]')
    ;(firstLayer.element as HTMLElement).focus()
    await firstLayer.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-layer-id')).toBe('field-b')
    expect(wrapper.emitted('selectLayer')?.at(-1)).toEqual(['field-b', 'replace'])

    await wrapper.get('[data-layer-id="field-b"]').trigger('keydown', { altKey: true, key: 'ArrowLeft' })
    expect(wrapper.emitted('arrangeLayer')?.at(-1)).toEqual(['outdent', 'field-b'])

    await wrapper.get('[data-designer-left-tab="pages"]').trigger('click')
    const firstPage = wrapper.get('[data-page-id="page-a"]')
    ;(firstPage.element as HTMLButtonElement).focus()
    await firstPage.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-page-id')).toBe('page-b')
    expect(wrapper.emitted('selectPage')?.at(-1)).toEqual(['page-b'])
    wrapper.unmount()
  })
})
