import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  AntdVueDesignerOption,
  AntdVueOptionSource,
  AntdVueResolvedOptionState,
} from '../../types'
import { useDesignerResolvedOptions } from '@moluoxixi/config-form-designer'
import { useAntdVueOptionResolverContext } from './context'

export function useAntdVueResolvedOptions(
  source: MaybeRefOrGetter<AntdVueOptionSource | undefined>,
  staticOptions: MaybeRefOrGetter<AntdVueDesignerOption[] | undefined>,
): Readonly<Ref<AntdVueResolvedOptionState>> {
  return useDesignerResolvedOptions<
    AntdVueDesignerOption,
    AntdVueOptionSource,
    AntdVueResolvedOptionState
  >(source, staticOptions, useAntdVueOptionResolverContext())
}
