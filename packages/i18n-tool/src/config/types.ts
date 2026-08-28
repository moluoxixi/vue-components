import type { I18nextSemanticsOptions, JsonKeyStyle, LocaleAdapterId, LocaleLayout } from '../core'

interface I18nToolAiConfigBase {
  apiKeyEnv: string
  model: string
}

export interface I18nToolResourceConfigInput {
  adapter: LocaleAdapterId
  adapterOptions?: I18nextSemanticsOptions
  exclude?: readonly string[]
  include?: readonly string[]
  keyStyle?: JsonKeyStyle
  layout: LocaleLayout
  localePattern: string
  namespace?: string
  sourceLocale: string
  targetLocales: readonly string[]
}

export type I18nToolAiConfigInput
  = | I18nToolAiConfigBase & { provider: 'anthropic' | 'google' | 'openai', baseUrl?: never }
    | I18nToolAiConfigBase & { provider: 'openai-compatible', baseUrl: string }

export interface I18nToolServerConfigInput {
  host?: boolean | string
  open?: boolean | string
  port?: number
}

export interface I18nToolLimitsInput {
  bodyBytes?: number
  concurrentApplies?: number
  concurrentTranslations?: number
  files?: number
  keys?: number
  totalBytes?: number
}

export interface I18nToolConfigInput {
  ai: I18nToolAiConfigInput
  limits?: I18nToolLimitsInput
  resources: I18nToolResourceConfigInput
  root?: string
  server?: I18nToolServerConfigInput
}

export interface I18nToolCliOverrides {
  host?: boolean | string
  open?: boolean | string
  port?: number
  root?: string
}

export interface ResolvedI18nToolConfig {
  ai: I18nToolAiConfigInput
  configPath: string
  limits: Required<I18nToolLimitsInput>
  resources: Required<Omit<I18nToolResourceConfigInput, 'adapterOptions' | 'namespace'>> & {
    adapterOptions?: I18nextSemanticsOptions
    namespace?: string
  }
  root: string
  server: Required<I18nToolServerConfigInput>
}
