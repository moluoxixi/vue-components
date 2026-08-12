import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  AntdVueDesignerOption,
  AntdVueOptionSource,
  AntdVueResolvedOptionState,
} from './types'
import {
  createMissingDesignerOptionSourceState,
  normalizeDesignerOptions,
  readDesignerOptionSource,
} from '@moluoxixi/config-form-designer'
import { ref, toValue, watch } from 'vue'
import { useAntdVueOptionResolverContext } from './context'

export function useAntdVueResolvedOptions(
  source: MaybeRefOrGetter<AntdVueOptionSource | undefined>,
  staticOptions: MaybeRefOrGetter<AntdVueDesignerOption[] | undefined>,
): Readonly<Ref<AntdVueResolvedOptionState>> {
  const context = useAntdVueOptionResolverContext()
  const state = ref<AntdVueResolvedOptionState>({ status: 'idle', options: [] })

  watch(
    [() => toValue(source), () => toValue(staticOptions)],
    async ([nextSource, nextStaticOptions], _previous, onCleanup) => {
      const fallback = normalizeAntdVueOptions(nextStaticOptions)
      const abortController = new AbortController()
      onCleanup(() => abortController.abort())

      if (!nextSource || nextSource.kind === 'static') {
        state.value = { status: 'ready', options: fallback }
        return
      }

      const writeState = (nextState: AntdVueResolvedOptionState): void => {
        state.value = nextState
        context.writeState(nextSource, nextState)
      }

      if (nextSource.kind === 'dictionary') {
        const dictionary = context.dictionaries[nextSource.key]
        writeState(dictionary
          ? { status: 'ready', options: normalizeAntdVueOptions(dictionary) }
          : missingSourceState('dictionary', nextSource.key, fallback))
        return
      }

      const provider = context.providers[nextSource.key]
      if (!provider) {
        writeState(missingSourceState('provider', nextSource.key, fallback))
        return
      }

      writeState({ status: 'loading', options: fallback })
      try {
        const options = normalizeAntdVueOptions(await provider({
          key: nextSource.key,
          params: nextSource.params,
          signal: abortController.signal,
        }))
        if (!abortController.signal.aborted)
          writeState({ status: 'ready', options })
      }
      catch (error) {
        if (!abortController.signal.aborted) {
          writeState({
            status: 'error',
            options: fallback,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    },
    { deep: true, immediate: true },
  )

  return state
}

export function readAntdVueOptionSource(value: unknown): AntdVueOptionSource | undefined {
  return readDesignerOptionSource(value)
}

export function normalizeAntdVueOptions(options: readonly unknown[] | undefined): AntdVueDesignerOption[] {
  return normalizeDesignerOptions(options)
}

function missingSourceState(
  kind: 'dictionary' | 'provider',
  key: string,
  fallback: AntdVueDesignerOption[],
): AntdVueResolvedOptionState {
  return createMissingDesignerOptionSourceState(kind, key, fallback)
}
