// @vitest-environment happy-dom

import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createProjectDocumentFixture } from '../../project/__tests__/fixtures'
import { WorkbenchCommandHint, WorkbenchTopbar } from '../components'

const project = createProjectDocumentFixture({ id: 'app', name: 'Account app' })
const currentPage = project.pagesById[project.homePageId]!

function overlayRoot(): DOMWrapper<Element> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

describe('workbench topbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays" data-theme="dark"></div>'
  })

  afterEach(() => document.body.replaceChildren())

  it('opens a keyboard navigable export menu and emits the selected projection', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        paletteFamily: 'catppuccin',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    const trigger = wrapper.get('button[aria-label="Export"]')
    await trigger.trigger('click')
    const overlays = overlayRoot()
    const items = overlays.findAll('[data-export-menu] [role="menuitem"]')
    expect(items).toHaveLength(2)
    expect(overlays.find('[data-export-menu]').exists()).toBe(true)
    expect(items.map(item => item.text())).toEqual(['Export source', 'Export config'])
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(items.every(item => item.attributes('role') === 'menuitem')).toBe(true)
    await items[1]!.trigger('click')
    expect(wrapper.emitted('export')).toEqual([['config']])
    expect(overlays.get('[data-export-menu]').isVisible()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await overlays.get('[data-export-menu]').trigger('keydown', { code: 'Escape', key: 'Escape' })
    await nextTick()
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('keeps commands as host events instead of changing workspace state', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        dirty: true,
        localeId: 'en-US',
        paletteFamily: 'catppuccin',
        previewOpen: false,
        statusLabel: 'Unsaved',
        themePreference: 'light',
      },
    })

    expect(wrapper.get('.revision-state').text()).toContain('v0 · Unsaved')
    expect(wrapper.get('.revision-state').attributes('aria-live')).toBe('polite')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    const overlays = overlayRoot()
    const saveItems = overlays.findAll('[data-save-menu] [role="menuitem"]')
    expect(saveItems.map(item => item.text())).toEqual([
      'Save now',
      'Create named checkpoint',
      'Version history',
    ])
    await saveItems[0]!.trigger('click')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    await overlays.findAll('[data-save-menu] [role="menuitem"]')[1]!.trigger('click')
    await wrapper.get('button[aria-label="Save options"]').trigger('click')
    await overlays.findAll('[data-save-menu] [role="menuitem"]')[2]!.trigger('click')
    await wrapper.get('button[aria-label="Show preview"]').trigger('click')
    await wrapper.get('[data-create-trigger="topbar-new-page"]').trigger('click')
    expect(wrapper.get('button[aria-label="Open appearance settings"]')).toBeDefined()
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('createCheckpoint')).toHaveLength(1)
    expect(wrapper.emitted('openVersions')).toHaveLength(1)
    expect(wrapper.emitted('togglePreview')).toHaveLength(1)
    expect(wrapper.emitted('newPage')).toEqual([['topbar-new-page']])
    wrapper.unmount()
  })

  it('restores the stable mobile trigger before opening a dialog workspace', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        paletteFamily: 'catppuccin',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    const trigger = wrapper.get('button[aria-label="More actions"]')
    await trigger.trigger('click')
    const flow = overlayRoot().findAll('[data-mobile-action-menu] [role="menuitem"]').find(
      item => item.text() === 'Event flow orchestration',
    )!
    ;(flow.element as HTMLButtonElement).focus()
    await flow.trigger('click')

    expect(wrapper.emitted('openFlow')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('keeps responsive overflow status and disabled command explanations on one command surface', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        busy: true,
        currentPage,
        localeId: 'en-US',
        paletteFamily: 'catppuccin',
        repositoryRevision: 7,
        statusLabel: 'Saving',
        themePreference: 'dark',
      },
    })

    const commandHints = wrapper.findAllComponents(WorkbenchCommandHint)
    expect(commandHints).toHaveLength(5)
    expect(commandHints.every(hint => Boolean(hint.props('label')))).toBe(true)
    const flow = wrapper.get('button[aria-label="Event flow orchestration"]')
    expect(flow.attributes('aria-expanded')).toBe('false')
    expect(flow.attributes('title')).toBeUndefined()
    const save = wrapper.get('button[aria-label^="Save options"]')
    expect(save.attributes('aria-disabled')).toBe('true')
    expect(save.attributes('aria-haspopup')).toBe('menu')
    expect(save.attributes('aria-label')).toContain('Wait for the current operation to finish')
    expect(save.attributes('title')).toContain('Wait for the current operation to finish')
    expect(save.attributes('disabled')).toBeUndefined()

    await wrapper.get('button[aria-label="More actions"]').trigger('click')
    const status = overlayRoot().get('[data-mobile-action-menu] [role="status"]')
    expect(status.text()).toBe('v7 · Saving')
    wrapper.unmount()
  })

  it('shows the Flow command through the Element Plus tooltip on keyboard focus', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        paletteFamily: 'catppuccin',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    try {
      const flow = wrapper.get('button[aria-label="Event flow orchestration"]')
      ;(flow.element as HTMLButtonElement).focus()
      await vi.advanceTimersByTimeAsync(400)
      await nextTick()
      const tooltip = overlayRoot().get('.workbench-command-tooltip')
      expect(tooltip.text()).toBe('Event flow orchestration')
      expect(tooltip.attributes('role')).toBe('tooltip')
      expect(flow.attributes('aria-expanded')).toBe('false')
      expect(flow.attributes('aria-describedby')).toBeUndefined()
      expect(flow.element.parentElement?.getAttribute('aria-describedby')).toContain(tooltip.attributes('id'))
    }
    finally {
      wrapper.unmount()
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    }
  })

  it('routes appearance through the mobile More menu after restoring focus', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentPage,
        localeId: 'en-US',
        paletteFamily: 'rose-pine',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    const trigger = wrapper.get('button[aria-label="More actions"]')
    await trigger.trigger('click')
    const appearance = overlayRoot().findAll('[data-mobile-action-menu] [role="menuitem"]').find(
      item => item.text() === 'Open appearance settings',
    )!
    await appearance.trigger('click')
    expect(wrapper.emitted('openAppearance')).toHaveLength(1)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
