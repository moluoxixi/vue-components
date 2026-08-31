// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createProjectDocumentFixture } from '../../project/__tests__/fixtures'
import WorkbenchTopbar from '../WorkbenchTopbar.vue'

const project = createProjectDocumentFixture({ id: 'app', name: 'Account app' })
const currentPage = project.pagesById[project.homePageId]!

describe('workbench topbar', () => {
  it('opens a keyboard navigable export menu and emits the selected projection', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        statusLabel: 'Saved locally',
        theme: 'dark',
      },
    })

    const trigger = wrapper.get('button[aria-label="Export"]')
    await trigger.trigger('click')
    const items = wrapper.findAll('[role="menuitem"]')
    expect(items).toHaveLength(2)
    expect(items.map(item => item.text())).toEqual(['Export source', 'Export config'])
    expect(document.activeElement).toBe(items[0]!.element)

    await items[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1]!.element)
    await items[1]!.trigger('click')
    expect(wrapper.emitted('export')).toEqual([['config']])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await wrapper.get('[role="menu"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('keeps commands as host events instead of changing workspace state', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      props: {
        project,
        currentPage,
        dirty: true,
        localeId: 'en-US',
        previewOpen: false,
        statusLabel: 'Unsaved',
        theme: 'light',
      },
    })

    expect(wrapper.get('.revision-state').text()).toContain('v0 · Unsaved')
    expect(wrapper.get('.revision-state').attributes('aria-live')).toBe('polite')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    const saveItems = wrapper.findAll('.save-menu-popover [role="menuitem"]')
    expect(saveItems.map(item => item.text())).toEqual([
      'Save now',
      'Create named checkpoint',
      'Version history',
    ])
    await saveItems[0]!.trigger('click')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    await wrapper.findAll('.save-menu-popover [role="menuitem"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    await wrapper.findAll('.save-menu-popover [role="menuitem"]')[2]!.trigger('click')
    await wrapper.get('button[aria-label="Show preview"]').trigger('click')
    await wrapper.get('button[aria-label="Use dark theme"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('createCheckpoint')).toHaveLength(1)
    expect(wrapper.emitted('openVersions')).toHaveLength(1)
    expect(wrapper.emitted('togglePreview')).toHaveLength(1)
    expect(wrapper.emitted('toggleTheme')).toHaveLength(1)
  })

  it('restores the stable mobile trigger before opening a dialog workspace', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        statusLabel: 'Saved locally',
        theme: 'light',
      },
    })

    const trigger = wrapper.get('button[aria-label="More actions"]')
    await trigger.trigger('click')
    const flow = wrapper.findAll('[role="menuitem"]')
      .find(item => item.text() === 'Event flow orchestration')!
    ;(flow.element as HTMLButtonElement).focus()
    await flow.trigger('click')

    expect(wrapper.emitted('openFlow')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
