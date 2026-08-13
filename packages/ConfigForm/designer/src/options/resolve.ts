import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  DesignerOption,
  DesignerOptionProvider,
  DesignerOptionSource,
  DesignerResolvedOptionState,
} from './types'
import { ref, toValue, watch } from 'vue'
import {
  createMissingDesignerOptionSourceState,
  normalizeDesignerOptions,
} from './normalize'

export interface DesignerOptionResolverContext {
  dictionaries: Readonly<Record<string, readonly DesignerOption[]>>
  providers: Readonly<Record<string, DesignerOptionProvider>>
  writeState: (source: DesignerOptionSource, state: DesignerResolvedOptionState) => void
}

export function useDesignerResolvedOptions<
  TOption extends DesignerOption = DesignerOption,
  TSource extends DesignerOptionSource = DesignerOptionSource,
  TState extends DesignerResolvedOptionState = DesignerResolvedOptionState,
>(
  source: MaybeRefOrGetter<TSource | undefined>,
  staticOptions: MaybeRefOrGetter<TOption[] | undefined>,
  context: DesignerOptionResolverContext,
): Readonly<Ref<TState>> {
  const state = ref<DesignerResolvedOptionState>({ status: 'idle', options: [] })

  watch(
    [() => toValue(source), () => toValue(staticOptions)],
    async ([nextSource, nextStaticOptions], _previous, onCleanup) => {
      const fallback = normalizeDesignerOptions(nextStaticOptions)
      const abortController = new AbortController()
      onCleanup(() => abortController.abort())

      if (!nextSource || nextSource.kind === 'static') {
        state.value = { status: 'ready', options: fallback }
        return
      }

      const writeState = (nextState: DesignerResolvedOptionState): void => {
        state.value = nextState
        context.writeState(nextSource, nextState)
      }

      if (nextSource.kind === 'dictionary') {
        const dictionary = context.dictionaries[nextSource.key]
        writeState(dictionary
          ? { status: 'ready', options: normalizeDesignerOptions(dictionary) }
          : createMissingDesignerOptionSourceState('dictionary', nextSource.key, fallback))
        return
      }

      const provider = context.providers[nextSource.key]
      if (!provider) {
        writeState(createMissingDesignerOptionSourceState('provider', nextSource.key, fallback))
        return
      }

      writeState({ status: 'loading', options: fallback })
      try {
        const options = normalizeDesignerOptions(await provider({
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

  return state as Readonly<Ref<TState>>
}
