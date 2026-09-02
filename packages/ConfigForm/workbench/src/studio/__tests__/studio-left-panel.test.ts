// @vitest-environment happy-dom

import type { ProjectDocument } from '@moluoxixi/config-form-model'
import { createDesignerRegistry, DesignerPalette } from '@moluoxixi/config-form-designer'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { StudioLeftPanel } from '..'
import {
  createProjectDocumentFixture,
  duplicateProjectPage,
} from '../../project/__tests__/fixtures'

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

function studioProject(): ProjectDocument {
  const base = createProjectDocumentFixture({ id: 'app' })
  const pageA = duplicateProjectPage(base.pagesById[base.homePageId]!, 'page-a', 'Page A', '/a')
  const pageB = duplicateProjectPage(pageA, 'page-b', 'Page B', '/b')
  return createProjectDocumentFixture({
    id: 'app',
    homePageId: pageA.id,
    pageOrder: [pageA.id, pageB.id],
    pagesById: { [pageA.id]: pageA, [pageB.id]: pageB },
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
        currentPageId: 'page-a',
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
    await search.setValue('missing')
    expect(wrapper.get('.el-empty').text()).toContain('No materials')
    await search.setValue('Input')
    expect(wrapper.find('[data-specimen-node-id]').exists()).toBe(false)
    await wrapper.get('[data-material-key="test.input"]').trigger('click')
    expect(wrapper.emitted('addMaterial')).toEqual([['test.input']])
  })

  it('owns only view state and emits semantic layer and page commands', async () => {
    const wrapper = mount(StudioLeftPanel, {
      props: {
        project,
        currentPageId: 'page-a',
        form: {},
        history: {
          entries: [{ id: 'rename', label: 'Rename field', editVersion: 1, timestamp: 1_000 }],
          limit: 100,
          position: 1,
        },
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
    await wrapper.findAll('.designer-pages button')[1]!.trigger('click')
    await wrapper.get('.manage-pages-button').trigger('click')
    expect(wrapper.emitted('selectPage')).toEqual([['page-b']])
    expect(wrapper.emitted('managePages')).toHaveLength(1)

    await wrapper.get('[data-designer-left-tab="history"]').trigger('click')
    expect(wrapper.get('.designer-history-list').text()).toContain('Rename field')
    await wrapper.findAll('.designer-history-list button')[1]!.trigger('click')
    expect(wrapper.emitted('jumpHistory')).toEqual([[0]])
  })

  it('implements roving keyboard focus for the four views', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
        currentPageId: 'page-a',
        form: {},
        layers: [],
        materials: registry.listMaterials(),
        registry,
        selectedIds: [],
      },
    })

    const components = wrapper.get('[data-designer-left-tab="components"]')
    const componentTab = components.element.closest<HTMLElement>('[role="tab"]')!
    expect(components.attributes()).toMatchObject({
      'aria-label': 'Components',
      'title': 'Components',
    })
    expect(wrapper.findAll('.designer-left-tabs [role="tab"]')).toHaveLength(4)
    componentTab.focus()
    await componentTab.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'ArrowRight', key: 'ArrowRight' }))
    await nextTick()
    expect(document.activeElement).toBe(wrapper.get('[data-designer-left-tab="layers"]').element.closest('[role="tab"]'))
    wrapper.unmount()
  })

  it('provides keyboard selection and arrangement paths for layers and pages', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
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

  it('keeps layer actions in an accessible menu with keyboard focus restoration', async () => {
    const wrapper = mount(StudioLeftPanel, {
      attachTo: document.body,
      props: {
        project,
        currentPageId: 'page-a',
        form: {},
        layers: [{ id: 'field', label: 'Name', component: 'test.input', depth: 0 }],
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
    expect(items).toHaveLength(4)
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
