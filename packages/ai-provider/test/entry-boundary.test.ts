import { describe, expect, it } from 'vitest'
import * as root from '../index'
import * as server from '../server'
import * as shared from '../shared'

describe('browser-safe shared entry', () => {
  it('keeps the root and shared runtime surfaces equivalent', () => {
    const expected = [
      'AI_PROVIDER_ERROR_CODES',
      'AI_PROVIDER_IDS',
      'AiProviderError',
      'EMBEDDING_PROVIDER_IDS',
      'isAiProviderId',
      'isEmbeddingProviderId',
    ]

    expect(Object.keys(root).sort()).toEqual(expected)
    expect(Object.keys(shared).sort()).toEqual(expected)
  })

  it('does not expose server config or transport functions', () => {
    expect(shared).toHaveProperty('AiProviderError')
    expect(shared.isAiProviderId('anthropic')).toBe(true)
    expect(shared.isAiProviderId('unknown')).toBe(false)
    expect(shared.isEmbeddingProviderId('google')).toBe(true)
    expect(shared.isEmbeddingProviderId('anthropic')).toBe(false)
    expect(shared).not.toHaveProperty('loadProviderConfig')
    expect(shared).not.toHaveProperty('providerStatusOf')
    expect(shared).not.toHaveProperty('streamChat')
    expect(shared).not.toHaveProperty('embed')
    expect(shared).not.toHaveProperty('createLanguageModel')
    expect(shared).not.toHaveProperty('createEmbeddingModel')
    expect(shared).not.toHaveProperty('aiRuntimeStatusOf')
    expect(shared).not.toHaveProperty('createAiProviderError')
    expect(shared).not.toHaveProperty('getAiProviderErrorCause')
    expect(shared).not.toHaveProperty('redactSensitiveText')
    expect(root).not.toHaveProperty('createLanguageModel')
    expect(root).not.toHaveProperty('createEmbeddingModel')
    expect(root).not.toHaveProperty('aiRuntimeStatusOf')
    expect(root).not.toHaveProperty('createAiProviderError')
    expect(root).not.toHaveProperty('getAiProviderErrorCause')
    expect(root).not.toHaveProperty('redactSensitiveText')
  })

  it('exposes model factories without the removed transport API', () => {
    expect(Object.keys(server).sort()).toEqual([
      'AI_PROVIDER_ERROR_CODES',
      'AI_PROVIDER_IDS',
      'AiProviderError',
      'EMBEDDING_PROVIDER_IDS',
      'aiRuntimeStatusOf',
      'createAiProviderError',
      'createEmbeddingModel',
      'createLanguageModel',
      'getAiProviderErrorCause',
      'isAiProviderId',
      'isEmbeddingProviderId',
      'redactSensitiveText',
    ])
    expect(server).toHaveProperty('createLanguageModel')
    expect(server).toHaveProperty('createEmbeddingModel')
    expect(server).toHaveProperty('aiRuntimeStatusOf')
    expect(server).toHaveProperty('createAiProviderError')
    expect(server).toHaveProperty('getAiProviderErrorCause')
    expect(server).toHaveProperty('redactSensitiveText')
    expect(server).not.toHaveProperty('loadProviderConfig')
    expect(server).not.toHaveProperty('providerStatusOf')
    expect(server).not.toHaveProperty('streamChat')
    expect(server).not.toHaveProperty('embed')
  })
})
