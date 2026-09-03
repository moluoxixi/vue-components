import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from '../../types'
import { useDesignerResolvedOptions } from '@moluoxixi/config-form-designer'
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
