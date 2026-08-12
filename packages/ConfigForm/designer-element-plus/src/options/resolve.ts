import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from './types'
import {
  createDesignerOptionKey,
  createMissingDesignerOptionSourceState,
  normalizeDesignerOptions,
  readDesignerOptionSource,
} from '@moluoxixi/config-form-designer'
import { ref, toValue, watch } from 'vue'
import { useElementPlusOptionResolverContext } from './context'

export function useElementPlusResolvedOptions(
  source: MaybeRefOrGetter<ElementPlusOptionSource | undefined>,
  staticOptions: MaybeRefOrGetter<ElementPlusDesignerOption[] | undefined>,
): Readonly<Ref<ElementPlusResolvedOptionState>> {
  const context = useElementPlusOptionResolverContext()
  const state = ref<ElementPlusResolvedOptionState>({ status: 'idle', options: [] })

  watch(
    [() => toValue(source), () => toValue(staticOptions)],
    async ([nextSource, nextStaticOptions], _previous, onCleanup) => {
      const fallback = normalizeElementPlusOptions(nextStaticOptions)
      const abortController = new AbortController()
      onCleanup(() => abortController.abort())

      if (!nextSource || nextSource.kind === 'static') {
        state.value = { status: 'ready', options: fallback }
        return
      }

      const writeState = (nextState: ElementPlusResolvedOptionState): void => {
        state.value = nextState
        context.writeState(nextSource, nextState)
      }

      if (nextSource.kind === 'dictionary') {
        const dictionary = context.dictionaries[nextSource.key]
        writeState(dictionary
          ? { status: 'ready', options: normalizeElementPlusOptions(dictionary) }
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
        const options = normalizeElementPlusOptions(await provider({
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

function missingSourceState(
  kind: 'dictionary' | 'provider',
  key: string,
  fallback: ElementPlusDesignerOption[],
): ElementPlusResolvedOptionState {
  return createMissingDesignerOptionSourceState(kind, key, fallback)
}
