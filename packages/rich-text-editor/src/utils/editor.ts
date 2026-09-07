import type { Editor } from '@tiptap/core'

export function toCssDimension(value: number | string | undefined): string | undefined {
  if (value === undefined || value === '')
    return undefined
  return typeof value === 'number' ? (Number.isFinite(value) && value >= 0 ? `${value}px` : undefined) : value
}

export function getOutputHTML(editor: Editor): string {
  return editor.isEmpty ? '' : editor.getHTML()
}

function hasUnsafeCharacters(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127 || character === '\\')
}

/** Shared by typed links, HTML parsing, paste rules and autolinking. */
export function isAllowedHref(value: string): boolean {
  if (!value || hasUnsafeCharacters(value))
    return false
  const href = value.trim()
  if (/^\/\//.test(href))
    return false
  if (/^(?:#|\/)/.test(href))
    return true
  try {
    const url = new URL(href)
    if (url.protocol === 'http:' || url.protocol === 'https:')
      return /^https?:\/\//i.test(href) && !!url.hostname && !url.username && !url.password
    return (url.protocol === 'mailto:' || url.protocol === 'tel:') && !!url.pathname.trim()
  }
  catch {
    return false
  }
}

export function normalizeHref(value: string): string {
  if (hasUnsafeCharacters(value))
    return ''
  const href = value.trim()
  const candidate = /^(?:[a-z][a-z\d+.-]*:|#|\/)/i.test(href) ? href : `https://${href}`
  return isAllowedHref(candidate) ? candidate : ''
}
