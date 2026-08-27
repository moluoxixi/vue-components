import type { I18nextSemanticsOptions, JsonKeyStyle, LocaleAdapterId, LocaleLayout } from '../core'

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

export interface I18nToolAiConfigInput {
  apiKeyEnv?: string
  baseUrl?: string
  model?: string
}

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
  ai?: I18nToolAiConfigInput
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
  ai: Required<I18nToolAiConfigInput>
  configPath: string
  limits: Required<I18nToolLimitsInput>
  resources: Required<Omit<I18nToolResourceConfigInput, 'adapterOptions' | 'namespace'>> & {
    adapterOptions?: I18nextSemanticsOptions
    namespace?: string
  }
  root: string
  server: Required<I18nToolServerConfigInput>
}
