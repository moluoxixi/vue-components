// @vitest-environment happy-dom

import type { VueWrapper } from '@vue/test-utils'
import { DOMWrapper, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import WorkbenchCommandHint from '../index.vue'

const HintHost = defineComponent({
  components: { WorkbenchCommandHint },
  template: `
    <div>
      <WorkbenchCommandHint label="Undo" shortcut="Ctrl/Cmd+Z" disabled-reason="No operation to undo">
        <button type="button" aria-label="Undo">Undo</button>
      </WorkbenchCommandHint>
      <WorkbenchCommandHint label="Redo" shortcut="Ctrl/Cmd+Shift+Z">
        <button type="button" aria-label="Redo">Redo</button>
      </WorkbenchCommandHint>
    </div>
  `,
})

function visibleTooltips(): DOMWrapper<Element>[] {
  return new DOMWrapper(document.getElementById('workbench-overlays')!)
    .findAll('.workbench-command-tooltip')
    .filter(tooltip => tooltip.isVisible())
}

async function finishShowDelay(): Promise<void> {
  await vi.advanceTimersByTimeAsync(400)
  await nextTick()
}

async function finishHideTransition(): Promise<void> {
  await nextTick()
  await vi.advanceTimersByTimeAsync(250)
  await nextTick()
}

function mountHost(): VueWrapper {
  return mount(HintHost, { attachTo: document.body })
}

describe('workbench command hint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="workbench-overlays" class="workbench-overlays"></div>'
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('uses the Element Plus tooltip for focus, ARIA description, content, and Escape', async () => {
    const wrapper = mountHost()
    const undo = wrapper.get('button[aria-label="Undo"]')

    ;(undo.element as HTMLButtonElement).focus()
    await finishShowDelay()

    const tooltip = visibleTooltips()[0]!
    expect(tooltip.text()).toBe('Undo · Ctrl/Cmd+Z · No operation to undo')
    expect(tooltip.attributes('role')).toBe('tooltip')
    expect(tooltip.classes()).toContain('is-light')
    expect(undo.attributes('aria-describedby')).toContain(tooltip.attributes('id'))

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }))
    await finishHideTransition()
    expect(visibleTooltips()).toHaveLength(0)
    expect(undo.attributes('aria-describedby')).toBeUndefined()

    wrapper.unmount()
  })

  it('suppresses a clicked command until the pointer leaves, then allows a later hint', async () => {
    const wrapper = mountHost()
    const undo = wrapper.get('button[aria-label="Undo"]')

    ;(undo.element as HTMLButtonElement).focus()
    await finishShowDelay()
    expect(visibleTooltips()).toHaveLength(1)

    undo.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await nextTick()
    await finishShowDelay()
    expect(visibleTooltips()).toHaveLength(0)

    await undo.trigger('mouseleave')
    await undo.trigger('mouseenter')
    await finishShowDelay()
    expect(visibleTooltips()).toHaveLength(1)

    wrapper.unmount()
  })

  it('closes for a peer hint event and removes document listeners on unmount', async () => {
    const removeEventListener = vi.spyOn(document, 'removeEventListener')
    const wrapper = mountHost()
    const undo = wrapper.get('button[aria-label="Undo"]')
    const redo = wrapper.get('button[aria-label="Redo"]')

    ;(undo.element as HTMLButtonElement).focus()
    await finishShowDelay()
    document.dispatchEvent(new CustomEvent('workbench-command-hint-shown', { detail: {} }))
    await finishHideTransition()
    expect(visibleTooltips()).toHaveLength(0)

    ;(undo.element as HTMLButtonElement).blur()
    await redo.trigger('mouseenter')
    await finishShowDelay()

    expect(visibleTooltips()).toHaveLength(1)
    expect(visibleTooltips()[0]!.text()).toBe('Redo · Ctrl/Cmd+Shift+Z')

    wrapper.unmount()
    expect(removeEventListener).toHaveBeenCalledWith('workbench-command-hint-shown', expect.any(Function))
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
