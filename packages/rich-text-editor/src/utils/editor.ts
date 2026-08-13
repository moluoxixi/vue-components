import type { Editor } from '@tiptap/core'

export function toCssDimension(value: number | string | undefined): string | undefined {
  if (value === undefined || value === '')
    return undefined
  return typeof value === 'number' ? `${value}px` : value
}

export function getOutputHTML(editor: Editor): string {
  return editor.isEmpty ? '' : editor.getHTML()
}

export function normalizeHref(value: string): string {
  const href = value.trim()
  if (!href || /^(?:https?:|mailto:|tel:|#|\/)/i.test(href))
    return href
  if (/^[a-z][a-z\d+.-]*:/i.test(href))
    return ''
  return `https://${href}`
}
