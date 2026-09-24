import type { DesignerOptionValueType } from '@moluoxixi/config-form-designer'
import type { ElementPlusDesignerOption } from '../../types'
import {
  createDesignerOptionKey,
  normalizeDesignerOptions,
} from '@moluoxixi/config-form-designer'

export function normalizeElementPlusOptions(
  options: readonly unknown[] | undefined,
  allowedValueTypes: readonly DesignerOptionValueType[],
): ElementPlusDesignerOption[] {
  return normalizeDesignerOptions(options, allowedValueTypes ?? [])
}

export function elementPlusOptionKey(
  value: ElementPlusDesignerOption['value'],
  index: number,
): string {
  return createDesignerOptionKey(value, index)
}
