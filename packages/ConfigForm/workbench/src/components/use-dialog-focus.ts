import type { Ref } from 'vue'
import { nextTick, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface WorkbenchDialogFocus {
  handleKeydown: (event: KeyboardEvent) => void
}

export function useWorkbenchDialogFocus(
  open: () => boolean,
  dialog: Ref<HTMLElement | null>,
  close: () => void,
): WorkbenchDialogFocus {
  let returnFocus: HTMLElement | undefined

  watch(open, async (opened) => {
    if (opened) {
      returnFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined
      await nextTick()
      dialog.value?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
      return
    }
    await nextTick()
    returnFocus?.focus()
    returnFocus = undefined
  }, { immediate: true })

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab' || !dialog.value)
      return

    const focusable = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    if (focusable.length === 0)
      return
    const first = focusable[0]!
    const last = focusable.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { handleKeydown }
}
