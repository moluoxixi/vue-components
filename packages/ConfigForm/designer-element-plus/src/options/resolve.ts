import type { MaybeRefOrGetter, Ref } from 'vue'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from './types'
import { isDesignerJsonObject } from '@moluoxixi/config-form-designer'
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
  if (!isRecord(value) || typeof value.kind !== 'string')
    return undefined
  if (value.kind === 'static')
    return { kind: 'static' }
  if ((value.kind !== 'dictionary' && value.kind !== 'provider') || typeof value.key !== 'string' || value.key.length === 0)
    return undefined
  if (value.kind === 'dictionary')
    return { kind: value.kind, key: value.key }
  if (value.params === undefined)
    return { kind: value.kind, key: value.key }
  if (isDesignerJsonObject(value.params))
    return { kind: value.kind, key: value.key, params: value.params }
  return undefined
}

export function normalizeElementPlusOptions(options: readonly unknown[] | undefined): ElementPlusDesignerOption[] {
  if (!options)
    return []
  return options.flatMap((option) => {
    if (!isRecord(option) || typeof option.label !== 'string' || !isOptionValue(option.value))
      return []
    return [{
      label: option.label,
      value: option.value,
      ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
    }]
  })
}

export function elementPlusOptionKey(
  value: ElementPlusDesignerOption['value'],
  index: number,
): string {
  return `${typeof value}:${String(value)}:${index}`
}

function missingSourceState(
  kind: 'dictionary' | 'provider',
  key: string,
  fallback: ElementPlusDesignerOption[],
): ElementPlusResolvedOptionState {
  return {
    status: 'error',
    options: fallback,
    error: `Unknown option ${kind}: ${key}`,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}
