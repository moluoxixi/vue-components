// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref, useTemplateRef } from 'vue'
import { useWorkbenchDialogFocus } from '..'

const DialogHarness = defineComponent({
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
      <button data-first>First</button>
      <button data-last>Last</button>
    </section>
  `,
})

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
})
