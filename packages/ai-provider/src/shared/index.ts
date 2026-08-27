export const AI_PROVIDER_ERROR_CODES = [
  'UPSTREAM_HTTP_ERROR',
  'UPSTREAM_NETWORK_ERROR',
  'UPSTREAM_PROTOCOL_ERROR',
  'EMBEDDING_COUNT_MISMATCH',
] as const

export type AiProviderErrorCode = typeof AI_PROVIDER_ERROR_CODES[number]

export interface AiProviderErrorOptions {
  retryable?: boolean
  status?: number
}

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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ProviderAvailability = 'configured' | 'missing'

/** Secret-free provider availability for browser-safe protocols. */
export interface ProviderStatus {
  chat: ProviderAvailability
  embedding: ProviderAvailability
}
