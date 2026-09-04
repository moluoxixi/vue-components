import type { AiProviderId, EmbeddingProviderId } from '../types'
import { AI_PROVIDER_IDS, EMBEDDING_PROVIDER_IDS } from '../constants'

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value)
}

export function isEmbeddingProviderId(value: unknown): value is EmbeddingProviderId {
  return typeof value === 'string' && (EMBEDDING_PROVIDER_IDS as readonly string[]).includes(value)
}
