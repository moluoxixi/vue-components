import type { App, InjectionKey, Plugin } from 'vue'
import type {
  ElementPlusOptionResolverConfig,
  ElementPlusOptionResolverContext,
  ElementPlusResolvedOptionState,
} from '../../types'
import {
  cloneDesignerResolvedOptionState,
  createDesignerOptionSourceCacheKey,
} from '@moluoxixi/config-form-designer'
import { inject, provide, ref } from 'vue'

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
      return states.get(createDesignerOptionSourceCacheKey(source))
    },
    writeState(source, state): void {
      states.set(createDesignerOptionSourceCacheKey(source), cloneDesignerResolvedOptionState(state))
      revision.value += 1
    },
  }
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
