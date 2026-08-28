// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  embeddingIdentitySeedOf,
  ENV_KEYS,
  loadProviderConfig,
  providerStatusOf,
} from '../src/server/ai-provider'

describe('loadProviderConfig', () => {
  it('loads independent explicit chat and embedding targets', () => {
    const config = loadProviderConfig({
      [ENV_KEYS.chatProvider]: 'anthropic',
      [ENV_KEYS.chatApiKey]: 'sk-chat',
      [ENV_KEYS.chatModel]: 'claude-sonnet',
      [ENV_KEYS.embeddingProvider]: 'google',
      [ENV_KEYS.embeddingApiKey]: 'sk-embed',
      [ENV_KEYS.embeddingModel]: 'gemini-embedding-001',
    })

    expect(config.chat).toEqual({
      provider: 'anthropic',
      apiKey: 'sk-chat',
      model: 'claude-sonnet',
    })
    expect(config.embedding).toEqual({
      provider: 'google',
      apiKey: 'sk-embed',
      model: 'gemini-embedding-001',
    })
  })

  it('requires complete capabilities without defaults or legacy fallback', () => {
    expect(() => loadProviderConfig({
      [ENV_KEYS.chatApiKey]: 'sk-chat',
    })).toThrow(/provider must explicitly select/)
    expect(() => loadProviderConfig({
      [ENV_KEYS.embeddingProvider]: 'openai',
      [ENV_KEYS.embeddingApiKey]: 'sk-embed',
    })).toThrow(/model is required/)
    expect(loadProviderConfig({})).toEqual({ chat: null, embedding: null })
  })

  it('requires and normalizes compatible baseURL', () => {
    expect(() => loadProviderConfig({
      [ENV_KEYS.chatProvider]: 'openai-compatible',
      [ENV_KEYS.chatApiKey]: 'sk-chat',
      [ENV_KEYS.chatModel]: 'relay-model',
    })).toThrow(/requires baseURL/)

    const config = loadProviderConfig({
      [ENV_KEYS.chatProvider]: 'openai-compatible',
      [ENV_KEYS.chatApiKey]: 'sk-chat',
      [ENV_KEYS.chatModel]: 'relay-model',
      [ENV_KEYS.chatBaseURL]: 'https://relay.example/v1///',
    })
    expect(config.chat).toEqual({
      provider: 'openai-compatible',
      apiKey: 'sk-chat',
      model: 'relay-model',
      baseURL: 'https://relay.example/v1',
    })
  })

  it('rejects custom endpoints for official providers', () => {
    expect(() => loadProviderConfig({
      [ENV_KEYS.embeddingProvider]: 'openai',
      [ENV_KEYS.embeddingApiKey]: 'sk-embed',
      [ENV_KEYS.embeddingModel]: 'text-embedding-3-small',
      [ENV_KEYS.embeddingBaseURL]: 'https://relay.example/v1',
    })).toThrow(/only supported by openai-compatible/)
  })
})

describe('providerStatusOf', () => {
  it('returns a secret-free capability projection', () => {
    const status = providerStatusOf(loadProviderConfig({
      [ENV_KEYS.chatProvider]: 'openai',
      [ENV_KEYS.chatApiKey]: 'sk-secret',
      [ENV_KEYS.chatModel]: 'gpt-4o-mini',
    }))
    expect(status).toEqual({
      chat: { availability: 'configured', provider: 'openai', model: 'gpt-4o-mini' },
      embedding: { availability: 'missing', provider: null, model: null },
    })
    expect(JSON.stringify(status)).not.toContain('sk-secret')
    expect(JSON.stringify(status)).not.toContain(ENV_KEYS.chatApiKey)
  })
})

describe('embeddingIdentitySeedOf', () => {
  it('fingerprints normalized compatible endpoints without retaining the URL', () => {
    const first = embeddingIdentitySeedOf({
      provider: 'openai-compatible',
      apiKey: 'first',
      model: 'embed',
      baseURL: 'https://relay.example/v1/',
    })
    const second = embeddingIdentitySeedOf({
      provider: 'openai-compatible',
      apiKey: 'second',
      model: 'embed',
      baseURL: 'https://relay.example/v1',
    })
    expect(first).toEqual(second)
    expect(JSON.stringify(first)).not.toContain('relay.example')
    expect(JSON.stringify(first)).not.toContain('first')
  })
})
