import type { EmbeddingModel, LanguageModel } from 'ai'
import type { EmbeddingModelTarget, LanguageModelTarget } from '../types'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAiProviderError } from '../services'

function requireText(value: string, field: 'apiKey' | 'model'): string {
  const normalized = value.trim()
  if (!normalized) {
    throw createAiProviderError(
      'INVALID_PROVIDER_CONFIG',
      `AI provider ${field} is required`,
    )
  }
  return normalized
}

function normalizeBaseURL(value: string): string {
  const normalized = value.trim()
  let url: URL

  try {
    url = new URL(normalized)
  }
  catch (cause) {
    throw createAiProviderError(
      'INVALID_PROVIDER_CONFIG',
      'OpenAI-compatible baseURL must be an absolute HTTP(S) URL',
      { cause },
    )
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw createAiProviderError(
      'INVALID_PROVIDER_CONFIG',
      'OpenAI-compatible baseURL must be an HTTP(S) URL without credentials, query, or fragment',
    )
  }

  return normalized.replace(/\/+$/, '')
}

function invalidProvider(provider: never): never {
  throw createAiProviderError(
    'INVALID_PROVIDER_CONFIG',
    `Unsupported AI provider: ${String(provider)}`,
  )
}

export function createLanguageModel(target: LanguageModelTarget): LanguageModel {
  const apiKey = requireText(target.apiKey, 'apiKey')
  const model = requireText(target.model, 'model')

  switch (target.provider) {
    case 'openai':
      return createOpenAI({ apiKey }).languageModel(model)
    case 'anthropic':
      return createAnthropic({ apiKey }).languageModel(model)
    case 'google':
      return createGoogle({ apiKey }).languageModel(model)
    case 'openai-compatible':
      return createOpenAICompatible({
        apiKey,
        baseURL: normalizeBaseURL(target.baseURL),
        name: 'openai-compatible',
      }).languageModel(model)
    default:
      return invalidProvider(target)
  }
}

export function createEmbeddingModel(target: EmbeddingModelTarget): EmbeddingModel {
  const apiKey = requireText(target.apiKey, 'apiKey')
  const model = requireText(target.model, 'model')

  switch (target.provider) {
    case 'openai':
      return createOpenAI({ apiKey }).embeddingModel(model)
    case 'google':
      return createGoogle({ apiKey }).embeddingModel(model)
    case 'openai-compatible':
      return createOpenAICompatible({
        apiKey,
        baseURL: normalizeBaseURL(target.baseURL),
        name: 'openai-compatible',
      }).embeddingModel(model)
    default:
      return invalidProvider(target)
  }
}
