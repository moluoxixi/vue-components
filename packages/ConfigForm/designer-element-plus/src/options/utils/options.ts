import type { ElementPlusDesignerOption } from '../../types'
import {
  createDesignerOptionKey,
  normalizeDesignerOptions,
} from '@moluoxixi/config-form-designer'

export function normalizeElementPlusOptions(options: readonly unknown[] | undefined): ElementPlusDesignerOption[] {
  return normalizeDesignerOptions(options)
}

export function elementPlusOptionKey(
  value: ElementPlusDesignerOption['value'],
  index: number,
): string {
  return createDesignerOptionKey(value, index)
}
