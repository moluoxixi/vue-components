export type AiProviderErrorCode = 'INVALID_PROVIDER_CONFIG'

export interface AiProviderErrorOptions {
  retryable?: boolean
  status?: number
}
