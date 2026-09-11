import type { Ref } from 'vue'
import type { WorkbenchDialogFocus } from '../types'
import { nextTick, onScopeDispose, watch } from 'vue'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

interface DialogFocusEntry {
  dialog: Ref<HTMLElement | null>
  returnFocus: HTMLElement | undefined
}

// Stacked so nested dialogs restore focus into the dialog below them when the
// original trigger has already left the document.
const dialogFocusEntries: DialogFocusEntry[] = []

function focusableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter(element => !element.closest('[inert], [aria-hidden="true"]'))
}

function removeEntry(entry: DialogFocusEntry): void {
  const index = dialogFocusEntries.indexOf(entry)
  if (index >= 0)
    dialogFocusEntries.splice(index, 1)
}

export function useWorkbenchDialogFocus(
  open: () => boolean,
  dialog: Ref<HTMLElement | null>,
  close: () => void,
): WorkbenchDialogFocus {
  let entry: DialogFocusEntry | undefined

  watch(open, async (opened) => {
    if (opened) {
      entry = {
        dialog,
        returnFocus: document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined,
      }
      dialogFocusEntries.push(entry)
      await nextTick()
      if (dialog.value)
        focusableElements(dialog.value)[0]?.focus()
      return
    }
    const closing = entry
    entry = undefined
    if (!closing)
      return
    removeEntry(closing)
    await nextTick()
    if (closing.returnFocus?.isConnected) {
      closing.returnFocus.focus()
      return
    }
    const fallback = dialogFocusEntries.at(-1)?.dialog.value
    if (fallback)
      focusableElements(fallback)[0]?.focus()
  }, { immediate: true })

  onScopeDispose(() => {
    if (entry)
      removeEntry(entry)
    entry = undefined
  })

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab' || !dialog.value)
      return

    const focusable = focusableElements(dialog.value)
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
