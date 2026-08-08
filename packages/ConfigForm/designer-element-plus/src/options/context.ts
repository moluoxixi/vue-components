import type { App, InjectionKey, Plugin, Ref } from 'vue'
import type {
  ElementPlusDesignerOption,
  ElementPlusOptionProvider,
  ElementPlusOptionResolverConfig,
  ElementPlusOptionSource,
  ElementPlusResolvedOptionState,
} from './types'
import { inject, provide, ref } from 'vue'

export interface ElementPlusOptionResolverContext {
  dictionaries: Readonly<Record<string, readonly ElementPlusDesignerOption[]>>
  providers: Readonly<Record<string, ElementPlusOptionProvider>>
  dictionaryKeys: string[]
  providerKeys: string[]
  revision: Readonly<Ref<number>>
  readState: (source: ElementPlusOptionSource) => ElementPlusResolvedOptionState | undefined
  writeState: (source: ElementPlusOptionSource, state: ElementPlusResolvedOptionState) => void
}

const EMPTY_CONTEXT = createElementPlusOptionResolverContext()

export const ELEMENT_PLUS_OPTION_RESOLVER_KEY: InjectionKey<ElementPlusOptionResolverContext>
  = Symbol('element-plus-option-resolver')

export function createElementPlusOptionResolverContext(
  config: ElementPlusOptionResolverConfig = {},
): ElementPlusOptionResolverContext {
  const dictionaries = config.dictionaries ?? {}
  const providers = config.providers ?? {}
  const revision = ref(0)
  const states = new Map<string, ElementPlusResolvedOptionState>()
  return {
    dictionaries,
    providers,
    dictionaryKeys: Object.keys(dictionaries),
    providerKeys: Object.keys(providers),
    revision,
    readState(source): ElementPlusResolvedOptionState | undefined {
      void revision.value
      return states.get(optionSourceCacheKey(source))
    },
    writeState(source, state): void {
      states.set(optionSourceCacheKey(source), {
        ...state,
        options: state.options.map(option => ({ ...option })),
      })
      revision.value += 1
    },
  }
}

function optionSourceCacheKey(source: ElementPlusOptionSource): string {
  return source.kind === 'provider'
    ? `${source.kind}:${source.key}:${JSON.stringify(source.params ?? null)}`
    : source.kind === 'dictionary'
      ? `${source.kind}:${source.key}`
      : source.kind
}

export function provideElementPlusOptionResolver(
  config: ElementPlusOptionResolverConfig = {},
): ElementPlusOptionResolverContext {
  const context = createElementPlusOptionResolverContext(config)
  provide(ELEMENT_PLUS_OPTION_RESOLVER_KEY, context)
  return context
}

export function createElementPlusOptionResolverPlugin(
  config: ElementPlusOptionResolverConfig = {},
): Plugin {
  const context = createElementPlusOptionResolverContext(config)
  return {
    install(app: App): void {
      app.provide(ELEMENT_PLUS_OPTION_RESOLVER_KEY, context)
    },
  }
}

export function useElementPlusOptionResolverContext(): ElementPlusOptionResolverContext {
  return inject(ELEMENT_PLUS_OPTION_RESOLVER_KEY, EMPTY_CONTEXT)
}
