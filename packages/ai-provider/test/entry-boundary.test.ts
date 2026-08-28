import { describe, expect, it } from 'vitest'
import * as server from '../server'
import * as shared from '../shared'

describe('browser-safe shared entry', () => {
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
  })

  it('exposes model factories without the removed transport API', () => {
    expect(server).toHaveProperty('createLanguageModel')
    expect(server).toHaveProperty('createEmbeddingModel')
    expect(server).toHaveProperty('aiRuntimeStatusOf')
    expect(server).not.toHaveProperty('loadProviderConfig')
    expect(server).not.toHaveProperty('providerStatusOf')
    expect(server).not.toHaveProperty('streamChat')
    expect(server).not.toHaveProperty('embed')
  })
})
