import type { DesignerOption } from '../types'

export function createDesignerOptionKey(
  value: DesignerOption['value'],
  index: number,
): string {
  return `${typeof value}:${String(value)}:${index}`
}
