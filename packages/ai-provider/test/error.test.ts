import { describe, expect, it } from 'vitest'
import {
  AiProviderError,
  createAiProviderError,
  getAiProviderErrorCause,
} from '../server'

describe('provider errors', () => {
  it('exposes a stable secret-free public error', () => {
    const error = new AiProviderError('INVALID_PROVIDER_CONFIG', 'invalid config')

    expect(error).toMatchObject({
      code: 'INVALID_PROVIDER_CONFIG',
      name: 'AiProviderError',
      retryable: false,
    })
    expect(error).not.toHaveProperty('cause')
  })

  it('keeps diagnostic causes on the server-only channel', () => {
    const cause = new Error('sensitive internal URL')
    const error = createAiProviderError('INVALID_PROVIDER_CONFIG', 'invalid config', { cause })

    expect(error).not.toHaveProperty('cause')
    expect(getAiProviderErrorCause(error)).toBe(cause)
  })
})
