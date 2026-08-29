// @vitest-environment happy-dom

import type { WorkspaceApplication } from '../../project'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import WorkbenchTopbar from '../WorkbenchTopbar.vue'

const application = {
  id: 'app',
  name: 'Account app',
  revision: 4,
  pages: [{ id: 'page', name: 'Profile', route: '/profile' }],
} as WorkspaceApplication

describe('workbench topbar', () => {
  it('opens a keyboard navigable export menu and emits the selected projection', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        application,
        currentPage: application.pages[0],
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
        application,
        currentPage: application.pages[0],
        dirty: true,
        localeId: 'en-US',
        previewOpen: false,
        statusLabel: 'Unsaved',
        theme: 'light',
      },
    })

    await wrapper.get('button[aria-label="Save"]').trigger('click')
    await wrapper.get('button[aria-label="Show preview"]').trigger('click')
    await wrapper.get('button[aria-label="Use dark theme"]').trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('togglePreview')).toHaveLength(1)
    expect(wrapper.emitted('toggleTheme')).toHaveLength(1)
  })

  it('restores the stable mobile trigger before opening a dialog workspace', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        application,
        currentPage: application.pages[0],
        localeId: 'en-US',
        statusLabel: 'Saved locally',
        theme: 'light',
      },
    })

    const trigger = wrapper.get('button[aria-label="More actions"]')
    await trigger.trigger('click')
    const flow = wrapper.findAll('[role="menuitem"]')
      .find(item => item.text() === 'Flow orchestration')!
    ;(flow.element as HTMLButtonElement).focus()
    await flow.trigger('click')

    expect(wrapper.emitted('openFlow')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
