import type { AiProviderId, EmbeddingProviderId } from '../types'

export const AI_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'openai-compatible',
] as const satisfies readonly AiProviderId[]

export const EMBEDDING_PROVIDER_IDS = [
  'openai',
  'google',
  'openai-compatible',
] as const satisfies readonly EmbeddingProviderId[]
