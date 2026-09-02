import type { App, InjectionKey, Plugin } from 'vue'
import type {
  AntdVueOptionResolverConfig,
  AntdVueOptionResolverContext,
  AntdVueResolvedOptionState,
} from '../../types'
import {
  cloneDesignerResolvedOptionState,
  createDesignerOptionSourceCacheKey,
} from '@moluoxixi/config-form-designer'
import { inject, provide, ref } from 'vue'

const EMPTY_CONTEXT = createAntdVueOptionResolverContext()

export const ANTD_VUE_OPTION_RESOLVER_KEY: InjectionKey<AntdVueOptionResolverContext>
  = Symbol('antd-vue-option-resolver')

export function createAntdVueOptionResolverContext(
  config: AntdVueOptionResolverConfig = {},
): AntdVueOptionResolverContext {
  const dictionaries = config.dictionaries ?? {}
  const providers = config.providers ?? {}
  const revision = ref(0)
  const states = new Map<string, AntdVueResolvedOptionState>()
  return {
    dictionaries,
    providers,
    dictionaryKeys: Object.keys(dictionaries),
    providerKeys: Object.keys(providers),
    revision,
    readState(source): AntdVueResolvedOptionState | undefined {
      void revision.value
      return states.get(createDesignerOptionSourceCacheKey(source))
    },
    writeState(source, state): void {
      states.set(createDesignerOptionSourceCacheKey(source), cloneDesignerResolvedOptionState(state))
      revision.value += 1
    },
  }
}

export function provideAntdVueOptionResolver(
  config: AntdVueOptionResolverConfig = {},
): AntdVueOptionResolverContext {
  const context = createAntdVueOptionResolverContext(config)
  provide(ANTD_VUE_OPTION_RESOLVER_KEY, context)
  return context
}

export function createAntdVueOptionResolverPlugin(
  config: AntdVueOptionResolverConfig = {},
): Plugin {
  const context = createAntdVueOptionResolverContext(config)
  return {
    install(app: App): void {
      app.provide(ANTD_VUE_OPTION_RESOLVER_KEY, context)
    },
  }
}

export function useAntdVueOptionResolverContext(): AntdVueOptionResolverContext {
  return inject(ANTD_VUE_OPTION_RESOLVER_KEY, EMPTY_CONTEXT)
}
