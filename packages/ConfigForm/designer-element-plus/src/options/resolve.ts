import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from './types'
import {
  createDesignerOptionKey,
  normalizeDesignerOptions,
  readDesignerOptionSource,
  useDesignerResolvedOptions,
} from '@moluoxixi/config-form-designer'
import { useElementPlusOptionResolverContext } from './context'

export function useElementPlusResolvedOptions(
  source: MaybeRefOrGetter<ElementPlusOptionSource | undefined>,
  staticOptions: MaybeRefOrGetter<ElementPlusDesignerOption[] | undefined>,
): Readonly<Ref<ElementPlusResolvedOptionState>> {
  return useDesignerResolvedOptions<
    ElementPlusDesignerOption,
    ElementPlusOptionSource,
    ElementPlusResolvedOptionState
  >(source, staticOptions, useElementPlusOptionResolverContext())
}

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
