// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref, useTemplateRef } from 'vue'
import { useWorkbenchDialogFocus } from '..'

function defineDialogHarness(content: string) {
  return defineComponent({
    setup(_, { expose }) {
      const open = ref(false)
      const dialog = useTemplateRef<HTMLElement>('dialog')
      const closed = ref(0)
      const { handleKeydown } = useWorkbenchDialogFocus(
        () => open.value,
        dialog,
        () => {
          closed.value += 1
          open.value = false
        },
      )
      expose({ closed, open })
      return { dialog, handleKeydown, open }
    },
    template: `
    <section v-if="open" ref="dialog" role="dialog" @keydown="handleKeydown">
      ${content}
    </section>
  `,
  })
}

const DialogHarness = defineDialogHarness(`
      <button data-first>First</button>
      <button data-last>Last</button>
`)

describe('useWorkbenchDialogFocus', () => {
  it('focuses on open, traps Tab, closes with Escape, and restores the trigger', async () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mount(DialogHarness, { attachTo: document.body })

    ;(wrapper.vm as unknown as { open: boolean }).open = true
    await nextTick()
    await nextTick()
    const first = wrapper.get('[data-first]')
    const last = wrapper.get('[data-last]')
    expect(document.activeElement).toBe(first.element)

    ;(last.element as HTMLButtonElement).focus()
    await last.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first.element)

    await first.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last.element)

    await last.trigger('keydown', { key: 'Escape' })
    await nextTick()
    await nextTick()
    expect((wrapper.vm as unknown as { closed: number }).closed).toBe(1)
    expect(document.activeElement).toBe(trigger)

    wrapper.unmount()
    trigger.remove()
  })

  it('falls back to the dialog below when the closing trigger left the document', async () => {
    const outer = mount(DialogHarness, { attachTo: document.body })
    const inner = mount(DialogHarness, { attachTo: document.body })

    ;(outer.vm as unknown as { open: boolean }).open = true
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(outer.get('[data-first]').element)

    // The inner dialog is opened from a control that disappears afterwards.
    const ephemeralTrigger = document.createElement('button')
    document.body.append(ephemeralTrigger)
    ephemeralTrigger.focus()
    ;(inner.vm as unknown as { open: boolean }).open = true
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(inner.get('[data-first]').element)
    ephemeralTrigger.remove()

    ;(inner.vm as unknown as { open: boolean }).open = false
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(outer.get('[data-first]').element)

    inner.unmount()
    outer.unmount()
  })

  it('skips focusables inside inert or aria-hidden subtrees', async () => {
    const HiddenContentHarness = defineDialogHarness(`
      <div aria-hidden="true"><button data-hidden>Hidden</button></div>
      <div inert><button data-inert>Inert</button></div>
      <button data-visible>Visible</button>
`)
    const wrapper = mount(HiddenContentHarness, { attachTo: document.body })

    ;(wrapper.vm as unknown as { open: boolean }).open = true
    await nextTick()
    await nextTick()
    const visible = wrapper.get('[data-visible]')
    expect(document.activeElement).toBe(visible.element)

    // The Tab trap cycles across the only visible focusable element.
    await visible.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(visible.element)
    await visible.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(visible.element)

    wrapper.unmount()
  })
})
