import type { App, InjectionKey, Plugin, Ref } from 'vue'
import type {
  AntdVueDesignerOption,
  AntdVueOptionProvider,
  AntdVueOptionResolverConfig,
  AntdVueOptionSource,
  AntdVueResolvedOptionState,
} from './types'
import { inject, provide, ref } from 'vue'

export interface AntdVueOptionResolverContext {
  dictionaries: Readonly<Record<string, readonly AntdVueDesignerOption[]>>
  providers: Readonly<Record<string, AntdVueOptionProvider>>
  dictionaryKeys: string[]
  providerKeys: string[]
  revision: Readonly<Ref<number>>
  readState: (source: AntdVueOptionSource) => AntdVueResolvedOptionState | undefined
  writeState: (source: AntdVueOptionSource, state: AntdVueResolvedOptionState) => void
}

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

function optionSourceCacheKey(source: AntdVueOptionSource): string {
  return source.kind === 'provider'
    ? `${source.kind}:${source.key}:${JSON.stringify(source.params ?? null)}`
    : source.kind === 'dictionary'
      ? `${source.kind}:${source.key}`
      : source.kind
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
