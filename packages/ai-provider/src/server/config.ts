import type { ProviderStatus } from '../shared'

/** Provider runtime config. Secret fields must remain server-only. */
export interface ProviderConfig {
  chatBaseUrl: string
  chatApiKey: string
  chatModel: string
  embeddingBaseUrl: string
  embeddingApiKey: string
  embeddingModel: string
}

export interface ProviderEnvKeys {
  chatBaseUrl: string
  chatApiKey: string
  chatModel: string
  embeddingBaseUrl: string
  embeddingApiKey: string
  embeddingModel: string
}

export interface ProviderDefaults {
  chatBaseUrl: string
  chatModel: string
  embeddingBaseUrl: string
  embeddingModel: string
}

export interface LoadProviderConfigOptions {
  defaults: ProviderDefaults
  envKeys: ProviderEnvKeys
}

export type ProviderEnvironment = Readonly<Record<string, string | undefined>>

export function loadProviderConfig(
  env: ProviderEnvironment,
  options: LoadProviderConfigOptions,
): ProviderConfig | null {
  const { defaults, envKeys } = options
  const chatApiKey = env[envKeys.chatApiKey]

  if (!chatApiKey)
    return null

  return {
    chatBaseUrl: env[envKeys.chatBaseUrl] || defaults.chatBaseUrl,
    chatApiKey,
    chatModel: env[envKeys.chatModel] || defaults.chatModel,
    embeddingBaseUrl: env[envKeys.embeddingBaseUrl] || defaults.embeddingBaseUrl,
    embeddingApiKey: env[envKeys.embeddingApiKey] || '',
    embeddingModel: env[envKeys.embeddingModel] || defaults.embeddingModel,
  }
}

export function providerStatusOf(config: ProviderConfig | null): ProviderStatus {
  if (!config)
    return { chat: 'missing', embedding: 'missing' }

  return {
    chat: config.chatApiKey ? 'configured' : 'missing',
    embedding: config.embeddingApiKey ? 'configured' : 'missing',
  }
}
