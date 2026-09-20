// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { createDesignerRegistry, DesignerPalette } from '@moluoxixi/config-form-designer'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { StudioLeftPanel } from '../../app'
import {
  createProjectDocumentFixture,
  duplicateProjectSurface,
} from '../../project/__tests__/fixtures'

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

function studioProject(): ProjectDocument {
  const base = createProjectDocumentFixture({ id: 'app' })
  const pageA = duplicateProjectSurface(base.surfacesById[base.homeSurfaceId]!, 'page-a', 'Surface A', '/a')
  const pageB = duplicateProjectSurface(pageA, 'page-b', 'Surface B', '/b')
  return createProjectDocumentFixture({
    id: 'app',
    homeSurfaceId: pageA.id,
    surfaceOrder: [pageA.id, pageB.id],
    surfacesById: { [pageA.id]: pageA, [pageB.id]: pageB },
  })
}

const project = studioProject()

function overlayRoot(): DOMWrapper<Element> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

describe('studio left panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays" data-theme="dark"></div>'
  })

  afterEach(() => document.body.replaceChildren())

  it('filters materials through the Element Plus search shell without changing palette commands', async () => {
    const wrapper = mount(StudioLeftPanel, {
      props: {
        project,
        currentSurfaceId: 'page-a',
        form: {},
        layers: [],
        materials: registry.listMaterials(),
        registry,
        selectedIds: [],
      },
    })

    const search = wrapper.get('input[aria-label="Search materials"]')
    const palette = wrapper.getComponent(DesignerPalette)
    expect(palette.props('showSearch')).toBe(false)
    expect(palette.find('.mx-config-form-designer__search').exists()).toBe(false)
    expect(wrapper.find('.el-scrollbar.designer-material-scrollbar').exists()).toBe(true)
    expect(wrapper.find('.el-collapse.designer-material-groups').exists()).toBe(true)
    expect(wrapper.get('.designer-material-category').text()).toBe('Fields')
    await search.setValue('missing')
    expect(wrapper.get('.el-empty').text()).toContain('No materials')
    await search.setValue('Input')
    expect(wrapper.find('[data-specimen-node-id]').exists()).toBe(false)
    const material = wrapper.get('.el-button[data-material-key="test.input"]')
    expect(material.attributes()).toMatchObject({
      'data-designer-draggable': 'true',
      'data-material-kind': 'field',
      'data-material-row-key': 'test.input',
    })
    await material.trigger('click')
    expect(wrapper.emitted('addMaterial')).toEqual([['test.input']])
  })

  it('owns only view state and emits semantic layer and page commands', async () => {
    const wrapper = mount(StudioLeftPanel, {
      props: {
        project,
        currentSurfaceId: 'page-a',
        form: {},
        history: {
          entries: [{ id: 'rename', label: 'Rename field', editVersion: 1, timestamp: 1_000 }],
          limit: 100,
          position: 1,
        },
        layers: [{ id: 'field', label: 'Name', component: 'test.input', depth: 1, canMoveBefore: true, canMoveAfter: false, canIndent: false, canOutdent: true }],
        materials: registry.listMaterials(),
        registry,
        selectedIds: ['field'],
      },
    })

    await wrapper.get('[data-designer-left-tab="layers"]').trigger('click')
    const layer = wrapper.get('[role="treeitem"]')
    expect(layer.attributes('aria-selected')).toBe('true')
    expect(layer.text()).toContain('Name')
    await layer.get('.designer-layer-select').trigger('click', { ctrlKey: true })
    expect(layer.text()).not.toContain('test.input')
    const menuTrigger = layer.get('.designer-layer-menu-trigger')
    await menuTrigger.trigger('click')
    expect(menuTrigger.attributes()).toMatchObject({
      'aria-haspopup': 'menu',
    })
    await overlayRoot().findAll('[data-layer-action-menu] [role="menuitem"]')[0]!.trigger('click')
    expect(wrapper.emitted('selectLayer')).toEqual([['field', 'toggle']])
    expect(wrapper.emitted('arrangeLayer')).toEqual([['moveBefore', 'field']])

    await wrapper.get('[data-designer-left-tab="pages"]').trigger('click')
    expect(wrapper.get('[data-surface-id="page-a"]').text()).toContain('Surface A')
    await wrapper.findAll('.designer-pages button')[1]!.trigger('click')
    await wrapper.get('.manage-pages-button').trigger('click')
    expect(wrapper.emitted('selectSurface')).toEqual([['page-b']])
    expect(wrapper.emitted('manageSurfaces')).toHaveLength(1)

    await wrapper.get('[data-designer-left-tab="history"]').trigger('click')
    expect(wrapper.get('.designer-history-list').text()).toContain('Rename field')
    await wrapper.findAll('.designer-history-list button')[1]!.trigger('click')
    expect(wrapper.emitted('jumpHistory')).toEqual([[0]])
  })

  it('implements roving keyboard focus for every view and exposes the theme workspace', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
        currentSurfaceId: 'page-a',
        form: {},
        layers: [],
        materials: registry.listMaterials(),
        registry,
        selectedIds: [],
      },
      slots: {
        theme: '<div data-project-theme-editor>Theme editor</div>',
      },
    })

    const components = wrapper.get('[data-designer-left-tab="components"]')
    const componentTab = components.element.closest<HTMLElement>('[role="tab"]')!
    expect(components.attributes()).toMatchObject({
      'aria-label': 'Components',
      'title': 'Components',
    })
    expect(wrapper.findAll('.designer-left-tabs [role="tab"]')).toHaveLength(5)
    componentTab.focus()
    await componentTab.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'ArrowRight', key: 'ArrowRight' }))
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-designer-left-tab="layers"]').element.closest('[role="tab"]'))
    await wrapper.get('[data-designer-left-tab="theme"]').trigger('click')
    expect(wrapper.get('[data-project-theme-editor]').text()).toBe('Theme editor')
    wrapper.unmount()
  })

  it('provides keyboard selection and arrangement paths for layers and pages', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
        currentSurfaceId: 'page-a',
        form: {},
        layers: [
          { id: 'field-a', label: 'First', component: 'test.input', depth: 0, canMoveBefore: false, canMoveAfter: true, canIndent: false, canOutdent: false },
          { id: 'field-b', label: 'Second', component: 'test.input', depth: 1, canMoveBefore: true, canMoveAfter: false, canIndent: false, canOutdent: true },
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
    const firstSurface = wrapper.get('[data-surface-id="page-a"]')
    ;(firstSurface.element as HTMLButtonElement).focus()
    await firstSurface.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-surface-id')).toBe('page-b')
    expect(wrapper.emitted('selectSurface')?.at(-1)).toEqual(['page-b'])
    wrapper.unmount()
  })

  it('keeps layer actions in an accessible menu with keyboard focus restoration', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
        currentSurfaceId: 'page-a',
        form: {},
        layers: [{ id: 'field', label: 'Name', component: 'test.input', depth: 0, canMoveBefore: false, canMoveAfter: true, canIndent: true, canOutdent: false }],
        materials: registry.listMaterials(),
        registry,
        selectedIds: ['field'],
      },
    })

    await wrapper.get('[data-designer-left-tab="layers"]').trigger('click')
    const trigger = wrapper.get('.designer-layer-menu-trigger')
    ;(trigger.element as HTMLButtonElement).focus()
    await trigger.trigger('click')
    await nextTick()
    const menu = overlayRoot().get('[data-layer-action-menu]')
    const items = menu.findAll('[role="menuitem"]')
    expect(items).toHaveLength(2)
    expect(items.map(item => item.text())).not.toContain('Outdent')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    ;(items[0]!.element as HTMLElement).focus()
    await items[0]!.trigger('keydown', { code: 'ArrowDown', key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1]!.element)
    await items[1]!.trigger('keydown', { code: 'Escape', key: 'Escape' })
    await nextTick()
    expect(overlayRoot().get('[data-layer-action-menu]').isVisible()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
