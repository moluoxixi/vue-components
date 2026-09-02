// @vitest-environment happy-dom

import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { WorkbenchCommandTooltip } from '../components'

describe('workbench command tooltip', () => {
  beforeEach(() => {
    document.body.innerHTML = [
      '<main id="root">',
      '<button aria-label="Undo" aria-disabled="true" data-command-hint data-command-shortcut="Ctrl/Cmd+Z" data-command-disabled-reason="No operation to undo">Undo</button>',
      '<button aria-label="Properties" aria-controls="properties" aria-expanded="true" data-command-hint>Properties</button>',
      '<div role="tab" tabindex="0"><span aria-label="Components" data-command-hint></span></div>',
      '</main>',
      '<div id="workbench-overlays">',
      '<button aria-label="Close preview" data-command-hint></button>',
      '<button role="menuitem">Export source</button>',
      '</div>',
    ].join('')
  })

  afterEach(() => document.body.replaceChildren())

  it('uses one localized command source for focus, shortcuts, disabled reasons, and Escape', async () => {
    const root = document.getElementById('root')!
    const button = root.querySelector('button')!
    const wrapper = mount(WorkbenchCommandTooltip, {
      attachTo: document.body,
      props: {
        overlayRoot: document.getElementById('workbench-overlays'),
        root,
      },
    })

    button.focus()
    await nextTick()
    const overlays = new DOMWrapper(document.getElementById('workbench-overlays')!)
    const tooltip = overlays.get('.workbench-command-tooltip')
    expect(tooltip.text()).toBe('Undo · Ctrl/Cmd+Z · No operation to undo')
    expect(tooltip.attributes('role')).toBe('tooltip')
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.get('span').attributes('id'))

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').isVisible()).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)

    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').isVisible()).toBe(false)

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }))
    button.setAttribute('aria-label', '撤销')
    button.setAttribute('data-command-disabled-reason', '没有可撤销操作')
    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').text()).toBe('撤销 · Ctrl/Cmd+Z · 没有可撤销操作')

    const tab = root.querySelector<HTMLElement>('[role="tab"]')!
    tab.focus()
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').text()).toBe('Components')

    const overlayButton = document.querySelector<HTMLElement>('[aria-label="Close preview"]')!
    overlayButton.focus()
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').text()).toBe('Close preview')

    const properties = root.querySelector<HTMLElement>('[aria-label="Properties"]')!
    properties.focus()
    await nextTick()
    expect(properties.getAttribute('aria-controls')).toBe('properties')
    expect(properties.getAttribute('aria-expanded')).toBe('true')
    expect(properties.hasAttribute('aria-describedby')).toBe(true)
    overlayButton.focus()
    await nextTick()
    expect(properties.getAttribute('aria-controls')).toBe('properties')
    expect(properties.getAttribute('aria-expanded')).toBe('true')
    expect(properties.hasAttribute('aria-describedby')).toBe(false)
    wrapper.unmount()
  })

  it('does not reopen a command hint when an overlay action restores trigger focus', async () => {
    const root = document.getElementById('root')!
    const trigger = root.querySelector('button')!
    const overlayRoot = document.getElementById('workbench-overlays')!
    const overlayAction = overlayRoot.querySelector<HTMLElement>('[role="menuitem"]')!
    const wrapper = mount(WorkbenchCommandTooltip, {
      attachTo: document.body,
      props: { overlayRoot, root },
    })
    const overlays = new DOMWrapper(overlayRoot)

    trigger.focus()
    await nextTick()
    expect(overlays.get('.workbench-command-tooltip').isVisible()).toBe(true)

    overlayAction.focus()
    overlayAction.click()
    trigger.focus()
    await nextTick()

    expect(overlays.get('.workbench-command-tooltip').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('keeps a later command focus hint available after a non-command root click', async () => {
    const root = document.getElementById('root')!
    const trigger = root.querySelector('button')!
    const overlayRoot = document.getElementById('workbench-overlays')!
    const wrapper = mount(WorkbenchCommandTooltip, {
      attachTo: document.body,
      props: { overlayRoot, root },
    })

    root.click()
    trigger.focus()
    await nextTick()

    expect(new DOMWrapper(overlayRoot).get('.workbench-command-tooltip').isVisible()).toBe(true)
    wrapper.unmount()
  })
})
