import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  AntdVueDesignerOption,
  AntdVueOptionSource,
  AntdVueResolvedOptionState,
} from '../../types'
import {
  normalizeDesignerOptions,
  readDesignerOptionSource,
  useDesignerResolvedOptions,
} from '@moluoxixi/config-form-designer'
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

export function readAntdVueOptionSource(value: unknown): AntdVueOptionSource | undefined {
  return readDesignerOptionSource(value)
}

export function normalizeAntdVueOptions(options: readonly unknown[] | undefined): AntdVueDesignerOption[] {
  return normalizeDesignerOptions(options)
}
