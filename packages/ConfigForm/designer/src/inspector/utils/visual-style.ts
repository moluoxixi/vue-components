import type { SurfaceNode } from '@moluoxixi/config-form-model'
import type { VisualStyleField } from '../types'
import { VISUAL_STYLE_ALIASES, VISUAL_STYLE_COLOR_OPTIONS } from '../constants'

/** Non-object styles and competing property spellings must survive visual editing intact. */
export function isVisualStyleEditable(node: SurfaceNode): boolean {
  const style = node.props.style
  return style === undefined || (typeof style === 'object' && style !== null && !Array.isArray(style)
    && !Object.keys(style).some(key => VISUAL_STYLE_ALIASES.has(key)))
}

export function readVisualStyle(node: SurfaceNode, key: string): unknown {
  return isVisualStyleEditable(node) && node.props.style
    ? (node.props.style as Record<string, unknown>)[key]
    : undefined
}

export function visualStyleValues(nodes: readonly SurfaceNode[], key: string): { mixed: boolean, value: unknown } {
  const value = nodes[0] ? readVisualStyle(nodes[0], key) : undefined
  return {
    mixed: nodes.some(node => !Object.is(readVisualStyle(node, key), value)),
    value,
  }
}

/** The visual editor authors a small CSS vocabulary; existing other styles stay untouched. */
export function parseVisualStyleValue(field: VisualStyleField, value: unknown): { valid: true, value: string | undefined } | { valid: false } {
  if (value === undefined || value === null || value === '')
    return { valid: true, value: undefined }
  const text = String(value).trim()
  if (!text)
    return { valid: true, value: undefined }
  if (field.control === 'select')
    return field.options?.some(option => option.value === text) ? { valid: true, value: text } : { valid: false }
  if (field.control === 'color') {
    return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(text)
      || VISUAL_STYLE_COLOR_OPTIONS.some(option => option.value === text)
      ? { valid: true, value: text }
      : { valid: false }
  }
  if (text === 'auto' && field.allowAuto)
    return { valid: true, value: text }
  const match = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(px|%|rem|em|vw|vh)?$/i.exec(text)
  if (!match || !Number.isFinite(Number(match[1])) || (!field.allowNegative && Number(match[1]) < 0)
    || (field.allowPercentage === false && match[2] === '%')) {
    return { valid: false }
  }
  const numeric = String(Number(match[1]))
  if (/e/i.test(numeric))
    return { valid: false }
  return { valid: true, value: `${numeric}${match[2]?.toLowerCase() ?? 'px'}` }
}
