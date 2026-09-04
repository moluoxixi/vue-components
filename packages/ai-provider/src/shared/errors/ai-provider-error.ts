import type { AiProviderErrorCode, AiProviderErrorOptions } from '../types'

/** Stable, secret-free error exposed across provider consumers. */
export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode
  readonly retryable: boolean
  readonly status?: number

  constructor(code: AiProviderErrorCode, message: string, options: AiProviderErrorOptions = {}) {
    super(message)
    this.name = 'AiProviderError'
    this.code = code
    this.retryable = options.retryable ?? false
    this.status = options.status
  }
}
