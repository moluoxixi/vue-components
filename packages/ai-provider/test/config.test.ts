import type { ProviderDefaults, ProviderEnvKeys } from '../server'
import { describe, expect, it } from 'vitest'
import { loadProviderConfig, providerStatusOf } from '../server'

const envKeys: ProviderEnvKeys = {
  chatBaseUrl: 'CHAT_BASE_URL',
  chatApiKey: 'CHAT_API_KEY',
  chatModel: 'CHAT_MODEL',
  embeddingBaseUrl: 'EMBEDDING_BASE_URL',
  embeddingApiKey: 'EMBEDDING_API_KEY',
  embeddingModel: 'EMBEDDING_MODEL',
}

const defaults: ProviderDefaults = {
  chatBaseUrl: 'https://default.example/v1',
  chatModel: 'chat-default',
  embeddingBaseUrl: 'https://default.example/v1',
  embeddingModel: 'embedding-default',
}

describe('provider config', () => {
  it('loads explicit keys and defaults without embedding key', () => {
    const config = loadProviderConfig({ CHAT_API_KEY: 'secret' }, { envKeys, defaults })
    expect(config).toEqual({
      chatBaseUrl: defaults.chatBaseUrl,
      chatApiKey: 'secret',
      chatModel: defaults.chatModel,
      embeddingBaseUrl: defaults.embeddingBaseUrl,
      embeddingApiKey: '',
      embeddingModel: defaults.embeddingModel,
    })
  })

  it('honors consumer-specific environment mappings', () => {
    const config = loadProviderConfig({
      CHAT_API_KEY: 'chat-secret',
      CHAT_BASE_URL: 'https://custom.example/v1',
      CHAT_MODEL: 'custom-chat',
      EMBEDDING_API_KEY: 'embedding-secret',
      EMBEDDING_MODEL: 'custom-embedding',
    }, { envKeys, defaults })

    expect(config?.chatBaseUrl).toBe('https://custom.example/v1')
    expect(config?.chatModel).toBe('custom-chat')
    expect(config?.embeddingModel).toBe('custom-embedding')
  })

  it('treats blank optional overrides as missing and falls back to defaults', () => {
    const config = loadProviderConfig({
      CHAT_API_KEY: 'chat-secret',
      CHAT_BASE_URL: '',
      CHAT_MODEL: '',
      EMBEDDING_BASE_URL: '',
      EMBEDDING_MODEL: '',
    }, { envKeys, defaults })

    expect(config?.chatBaseUrl).toBe(defaults.chatBaseUrl)
    expect(config?.chatModel).toBe(defaults.chatModel)
    expect(config?.embeddingBaseUrl).toBe(defaults.embeddingBaseUrl)
    expect(config?.embeddingModel).toBe(defaults.embeddingModel)
  })

  it('fails closed when the required chat key is missing', () => {
    expect(loadProviderConfig({}, { envKeys, defaults })).toBeNull()
  })

  it('returns a secret-free provider status', () => {
    const config = loadProviderConfig({
      CHAT_API_KEY: 'chat-secret',
      EMBEDDING_API_KEY: 'embedding-secret',
    }, { envKeys, defaults })
    const status = providerStatusOf(config)

    expect(status).toEqual({ chat: 'configured', embedding: 'configured' })
    expect(JSON.stringify(status)).not.toContain('secret')
    expect(providerStatusOf(null)).toEqual({ chat: 'missing', embedding: 'missing' })
  })
})
