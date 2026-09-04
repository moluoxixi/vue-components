import type { EmbeddingModelTarget, LanguageModelTarget } from '../server'
import { describe, expect, it } from 'vitest'
import {
  AiProviderError,
  aiRuntimeStatusOf,
  createEmbeddingModel,
  createLanguageModel,
} from '../server'

describe('aI SDK model factory', () => {
  it.each([
    [{ provider: 'openai', apiKey: 'secret', model: 'gpt-test' }, 'openai.responses'],
    [{ provider: 'anthropic', apiKey: 'secret', model: 'claude-test' }, 'anthropic.messages'],
    [{ provider: 'google', apiKey: 'secret', model: 'gemini-test' }, 'google.generative-ai'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://relay.example/v1/',
      model: 'relay-test',
    }, 'openai-compatible.chat'],
  ] satisfies Array<[LanguageModelTarget, string]>)('creates a %s language model', (target, provider) => {
    const model = createLanguageModel(target)
    expect(typeof model).not.toBe('string')
    if (typeof model === 'string')
      throw new TypeError('factory returned a registry model id instead of a model instance')
    expect(model.provider).toBe(provider)
    expect(model.modelId).toBe(target.model)
  })

  it.each([
    [{ provider: 'openai', apiKey: 'secret', model: 'embed-test' }, 'openai.embedding'],
    [{ provider: 'google', apiKey: 'secret', model: 'embed-test' }, 'google.generative-ai'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://relay.example/v1',
      model: 'embed-test',
    }, 'openai-compatible.embedding'],
  ] satisfies Array<[EmbeddingModelTarget, string]>)('creates a %s embedding model', (target, provider) => {
    const model = createEmbeddingModel(target)
    expect(typeof model).not.toBe('string')
    if (typeof model === 'string')
      throw new TypeError('factory returned a registry model id instead of a model instance')
    expect(model.provider).toBe(provider)
    expect(model.modelId).toBe(target.model)
  })

  it.each([
    [{ provider: 'openai', apiKey: '', model: 'gpt-test' }, 'apiKey'],
    [{ provider: 'openai', apiKey: '   ', model: 'gpt-test' }, 'apiKey'],
    [{ provider: 'openai', apiKey: 'secret', model: '' }, 'model'],
    [{ provider: 'openai', apiKey: 'secret', model: '   ' }, 'model'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'relative/v1',
      model: 'relay-test',
    }, 'baseURL'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://user:password@relay.example/v1',
      model: 'relay-test',
    }, 'baseURL'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'ftp://relay.example/v1',
      model: 'relay-test',
    }, 'baseURL'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://relay.example/v1?tenant=test',
      model: 'relay-test',
    }, 'baseURL'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://relay.example/v1#models',
      model: 'relay-test',
    }, 'baseURL'],
  ] satisfies Array<[LanguageModelTarget, string]>)('rejects invalid model target field %s', (target, field) => {
    expect(() => createLanguageModel(target)).toThrowError(AiProviderError)
    expect(() => createLanguageModel(target)).toThrow(field)
  })

  it('rejects unsupported providers at runtime', () => {
    const invalid = { provider: 'unknown', apiKey: 'secret', model: 'test' } as unknown as LanguageModelTarget
    expect(() => createLanguageModel(invalid)).toThrow('Unsupported AI provider')
  })

  it.each([
    [{ provider: 'openai', apiKey: ' ', model: 'embed-test' }, 'apiKey'],
    [{ provider: 'google', apiKey: 'secret', model: ' ' }, 'model'],
    [{
      provider: 'openai-compatible',
      apiKey: 'secret',
      baseURL: 'https://relay.example/v1?tenant=test',
      model: 'embed-test',
    }, 'baseURL'],
  ] satisfies Array<[EmbeddingModelTarget, string]>)('rejects invalid embedding target field %s', (target, field) => {
    expect(() => createEmbeddingModel(target)).toThrowError(AiProviderError)
    expect(() => createEmbeddingModel(target)).toThrow(field)
  })

  it('rejects unsupported embedding providers at runtime', () => {
    const invalid = { provider: 'anthropic', apiKey: 'secret', model: 'embed-test' } as unknown as EmbeddingModelTarget
    expect(() => createEmbeddingModel(invalid)).toThrow('Unsupported AI provider')
  })

  it('projects secret-free runtime status', () => {
    const status = aiRuntimeStatusOf({
      chat: { provider: 'anthropic', apiKey: 'chat-secret', model: 'claude-test' },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'embedding-secret',
        baseURL: 'https://relay.example/v1',
        model: 'embed-test',
      },
    })

    expect(status).toEqual({
      chat: { availability: 'configured', model: 'claude-test', provider: 'anthropic' },
      embedding: { availability: 'configured', model: 'embed-test', provider: 'openai-compatible' },
    })
    expect(JSON.stringify(status)).not.toContain('secret')
    expect(aiRuntimeStatusOf({ chat: null, embedding: null })).toEqual({
      chat: { availability: 'missing', model: null, provider: null },
      embedding: { availability: 'missing', model: null, provider: null },
    })
  })
})
