export const AI_PROVIDER_ERROR_CODES = [
  'INVALID_PROVIDER_CONFIG',
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

export const AI_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'openai-compatible',
] as const

export type AiProviderId = typeof AI_PROVIDER_IDS[number]

export const EMBEDDING_PROVIDER_IDS = [
  'openai',
  'google',
  'openai-compatible',
] as const satisfies readonly AiProviderId[]

export type EmbeddingProviderId = typeof EMBEDDING_PROVIDER_IDS[number]

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)
}

export function isEmbeddingProviderId(value: unknown): value is EmbeddingProviderId {
  return typeof value === 'string' && (EMBEDDING_PROVIDER_IDS as readonly string[]).includes(value)
}

export interface ModelTargetStatus {
  availability: ProviderAvailability
  model: string | null
  provider: AiProviderId | null
}

export interface AiRuntimeStatus {
  chat: ModelTargetStatus
  embedding: ModelTargetStatus
}

export type ProviderAvailability = 'configured' | 'missing'
