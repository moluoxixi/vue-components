export type AiProviderId = 'openai' | 'anthropic' | 'google' | 'openai-compatible'
export type EmbeddingProviderId = Exclude<AiProviderId, 'anthropic'>
export type ProviderAvailability = 'configured' | 'missing'

export interface ModelTargetStatus {
  availability: ProviderAvailability
  model: string | null
  provider: AiProviderId | null
}

export interface AiRuntimeStatus {
  chat: ModelTargetStatus
  embedding: ModelTargetStatus
}
