export class ClipboardCopyError extends Error {
  readonly primaryError: unknown
  readonly fallbackError: unknown

  constructor(primaryError: unknown, fallbackError: unknown) {
    const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError)
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)

    super(`${primaryMessage}; fallback failed: ${fallbackMessage}`)
    this.name = 'ClipboardCopyError'
    this.primaryError = primaryError
    this.fallbackError = fallbackError
  }
}

function copyWithTextarea(text: string): void {
  if (typeof document === 'undefined')
    throw new Error('Clipboard fallback requires a browser document')

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : []
  const textarea = document.createElement('textarea')

  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  Object.assign(textarea.style, {
    height: '1px',
    left: '-9999px',
    opacity: '0',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0',
    width: '1px',
  })

  document.body.append(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    if (typeof document.execCommand !== 'function' || !document.execCommand('copy'))
      throw new Error('document.execCommand("copy") failed')
  }
  finally {
    textarea.remove()
    activeElement?.focus()

    if (selection && ranges.length > 0) {
      selection.removeAllRanges()
      ranges.forEach(range => selection.addRange(range))
    }
  }
}

/** Write plain text to the clipboard, with a legacy browser fallback. */
export async function copyText(text: string): Promise<void> {
  let primaryError: unknown = new Error('Clipboard API is unavailable')

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    }
    catch (error) {
      primaryError = error
    }
  }

  try {
    copyWithTextarea(text)
  }
  catch (fallbackError) {
    throw new ClipboardCopyError(primaryError, fallbackError)
  }
}
