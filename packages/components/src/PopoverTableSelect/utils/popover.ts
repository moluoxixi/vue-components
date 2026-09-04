import type { ComponentPublicInstance } from 'vue'
import type { PopoverTableVirtualRef } from '../types'

export function resolveVirtualElement(target: PopoverTableVirtualRef): HTMLElement {
  return ((target as ComponentPublicInstance)?.$el || (target as any)?.input || target) as HTMLElement
}

export function toNumberSize(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value))
    return value

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i)
    if (match)
      return Number(match[1])
  }

  return fallback
}
