import type { AiProviderId, AiRuntimeStatus, ModelTargetStatus } from '../../shared'
import type { EmbeddingModelTarget, LanguageModelTarget } from '../types'

function statusOfTarget(
  target: { model: string, provider: AiProviderId } | null,
): ModelTargetStatus {
  if (!target) {
    return { availability: 'missing', model: null, provider: null }
  }

  return {
    availability: 'configured',
    model: target.model,
    provider: target.provider,
  }
}

export function aiRuntimeStatusOf(config: {
  chat: LanguageModelTarget | null
  embedding: EmbeddingModelTarget | null
}): AiRuntimeStatus {
  return {
    chat: statusOfTarget(config.chat),
    embedding: statusOfTarget(config.embedding),
  }
}
