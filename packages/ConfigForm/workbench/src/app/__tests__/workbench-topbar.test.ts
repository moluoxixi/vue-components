// @vitest-environment happy-dom

import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createProjectDocumentFixture } from '../../project/__tests__/fixtures'
import { WorkbenchCommandHint, WorkbenchTopbar } from '../components'

const project = createProjectDocumentFixture({ id: 'app', name: 'Account app' })
const currentSurface = project.surfacesById[project.homeSurfaceId]!

function overlayRoot(): DOMWrapper<Element> {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
}

describe('workbench topbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays" data-theme="dark"></div>'
  })

  afterEach(() => document.body.replaceChildren())

  it('keeps export projections inside the Source workspace instead of a topbar menu', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentSurface,
        localeId: 'en-US',
        paletteFamily: 'ink',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    expect(wrapper.find('button[aria-label="Export"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="Code"]').trigger('click')
    expect(wrapper.emitted('export')).toEqual([['source']])
    wrapper.unmount()
  })

  it('keeps commands as host events instead of changing workspace state', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentSurface,
        dirty: true,
        localeId: 'en-US',
        paletteFamily: 'ink',
        previewOpen: false,
        statusLabel: 'Unsaved',
        themePreference: 'light',
      },
    })

    expect(wrapper.get('.revision-state').text()).toContain('v0 · Unsaved')
    expect(wrapper.get('.revision-state').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('button[aria-label="Save options"] .topbar-command-label').text()).toBe('Save')
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
    expect(wrapper.find('[data-create-trigger="topbar-new-surface"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Open appearance settings"]')).toBeDefined()
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('createCheckpoint')).toHaveLength(1)
    expect(wrapper.emitted('openVersions')).toHaveLength(1)
    expect(wrapper.emitted('togglePreview')).toHaveLength(1)
    wrapper.unmount()
  })

  it('keeps responsive overflow status and disabled command explanations on one command surface', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        busy: true,
        currentSurface,
        localeId: 'en-US',
        paletteFamily: 'ink',
        repositoryRevision: 7,
        statusLabel: 'Saving',
        themePreference: 'dark',
      },
    })

    const commandHints = wrapper.findAllComponents(WorkbenchCommandHint)
    expect(commandHints).toHaveLength(3)
    expect(commandHints.every(hint => Boolean(hint.props('label')))).toBe(true)
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

  it('switches workspace modes through their commands and reports the active view', async () => {
    const wrapper = mount(WorkbenchTopbar, {
      props: { project, currentSurface, localeId: 'en-US', paletteFamily: 'ink', statusLabel: 'Saved', themePreference: 'light' },
    })
    expect(wrapper.get('button[aria-label="Design"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('button[aria-label="Code"]').trigger('click')
    expect(wrapper.emitted('export')).toEqual([['source']])
    await wrapper.setProps({ sourceOpen: true })
    expect(wrapper.get('button[aria-label="Code"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button[aria-label="Design"]').attributes('aria-pressed')).toBe('false')
    await wrapper.get('button[aria-label="Design"]').trigger('click')
    expect(wrapper.emitted('showDesign')).toHaveLength(1)
    wrapper.unmount()
  })

  it('shows a command through the Element Plus tooltip on keyboard focus', async () => {
    vi.useFakeTimers()
    const wrapper = mount(WorkbenchTopbar, {
      attachTo: document.body,
      props: {
        project,
        currentSurface,
        localeId: 'en-US',
        paletteFamily: 'ink',
        statusLabel: 'Saved locally',
        themePreference: 'system',
      },
    })

    try {
      const managerButton = wrapper.get('button[aria-label="Manage pages"]')
      ;(managerButton.element as HTMLButtonElement).focus()
      await vi.advanceTimersByTimeAsync(400)
      await nextTick()
      const tooltip = overlayRoot().get('.workbench-command-tooltip')
      expect(tooltip.text()).toBe('Manage pages')
      expect(tooltip.attributes('role')).toBe('tooltip')
      expect(managerButton.attributes('aria-describedby')).toContain(tooltip.attributes('id'))
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
        currentSurface,
        localeId: 'en-US',
        paletteFamily: 'glass',
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
