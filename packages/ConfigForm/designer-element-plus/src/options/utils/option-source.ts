import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
} from '../../types'
import {
  createDesignerOptionKey,
  normalizeDesignerOptions,
  readDesignerOptionSource,
} from '@moluoxixi/config-form-designer'

export function readElementPlusOptionSource(value: unknown): ElementPlusOptionSource | undefined {
  return readDesignerOptionSource(value)
}

export function normalizeElementPlusOptions(options: readonly unknown[] | undefined): ElementPlusDesignerOption[] {
  return normalizeDesignerOptions(options)
}

export function elementPlusOptionKey(
  value: ElementPlusDesignerOption['value'],
  index: number,
): string {
  return createDesignerOptionKey(value, index)
}
