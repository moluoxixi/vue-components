import type { AiRuntimeStatus, ChatProvider, EmbeddingProviderId } from '../shared/protocol'
import { createHash } from 'node:crypto'
import process from 'node:process'

export type { AiRuntimeStatus } from '../shared/protocol'

interface ModelConfigBase { apiKey: string, model: string }
export type AiDocChatConfig = ModelConfigBase & ({ provider: 'openai' } | { provider: 'anthropic' } | { provider: 'google' } | { provider: 'openai-compatible', baseURL: string })
export type AiDocEmbeddingConfig = ModelConfigBase & ({ provider: 'openai' } | { provider: 'google' } | { provider: 'openai-compatible', baseURL: string })

export interface AiDocProviderConfig {
  chat: AiDocChatConfig | null
  embedding: AiDocEmbeddingConfig | null
}

export interface EmbeddingIdentitySeed {
  endpointFingerprint: string
  model: string
  provider: AiDocEmbeddingConfig['provider']
}

/** Environment names are server-only and never enter public status payloads. */
export const ENV_KEYS = {
  chatProvider: 'AI_DOC_CHAT_PROVIDER',
  chatApiKey: 'AI_DOC_CHAT_API_KEY',
  chatModel: 'AI_DOC_CHAT_MODEL',
  chatBaseURL: 'AI_DOC_CHAT_BASE_URL',
  embeddingProvider: 'AI_DOC_EMBEDDING_PROVIDER',
  embeddingApiKey: 'AI_DOC_EMBEDDING_API_KEY',
  embeddingModel: 'AI_DOC_EMBEDDING_MODEL',
  embeddingBaseURL: 'AI_DOC_EMBEDDING_BASE_URL',
} as const

type Capability = 'chat' | 'embedding'

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function invalidConfig(capability: Capability, message: string): never {
  throw new Error(`${capability} provider configuration is invalid: ${message}`)
}

function normalizedCompatibleBaseURL(value: string, capability: Capability): string {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    return invalidConfig(capability, 'baseURL must be an absolute HTTP(S) URL')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    return invalidConfig(capability, 'baseURL must not contain credentials, query, or fragment')

  return url.href.replace(/\/+$/, '')
}

function isAiProviderId(value: string): value is ChatProvider {
  return ['openai', 'anthropic', 'google', 'openai-compatible'].includes(value)
}
function isEmbeddingProviderId(value: string): value is EmbeddingProviderId {
  return ['openai', 'google', 'openai-compatible'].includes(value)
}

function loadLanguageTarget(env: NodeJS.ProcessEnv): AiDocChatConfig | null {
  const provider = optionalText(env[ENV_KEYS.chatProvider])
  const apiKey = optionalText(env[ENV_KEYS.chatApiKey])
  const model = optionalText(env[ENV_KEYS.chatModel])
  const baseURL = optionalText(env[ENV_KEYS.chatBaseURL])

  if (!provider && !apiKey && !model && !baseURL)
    return null
  if (!provider || !isAiProviderId(provider))
    return invalidConfig('chat', 'provider must explicitly select a supported provider')
  if (!apiKey)
    return invalidConfig('chat', 'apiKey is required')
  if (!model)
    return invalidConfig('chat', 'model is required')

  if (provider === 'openai-compatible') {
    if (!baseURL)
      return invalidConfig('chat', 'openai-compatible requires baseURL')
    return { provider, apiKey, model, baseURL: normalizedCompatibleBaseURL(baseURL, 'chat') }
  }
  if (baseURL)
    return invalidConfig('chat', 'baseURL is only supported by openai-compatible')
  return { provider, apiKey, model }
}

function loadEmbeddingTarget(env: NodeJS.ProcessEnv): AiDocEmbeddingConfig | null {
  const provider = optionalText(env[ENV_KEYS.embeddingProvider])
  const apiKey = optionalText(env[ENV_KEYS.embeddingApiKey])
  const model = optionalText(env[ENV_KEYS.embeddingModel])
  const baseURL = optionalText(env[ENV_KEYS.embeddingBaseURL])

  if (!provider && !apiKey && !model && !baseURL)
    return null
  if (!provider || !isEmbeddingProviderId(provider))
    return invalidConfig('embedding', 'provider must explicitly select OpenAI, Google, or OpenAI-compatible')
  if (!apiKey)
    return invalidConfig('embedding', 'apiKey is required')
  if (!model)
    return invalidConfig('embedding', 'model is required')

  if (provider === 'openai-compatible') {
    if (!baseURL)
      return invalidConfig('embedding', 'openai-compatible requires baseURL')
    return { provider, apiKey, model, baseURL: normalizedCompatibleBaseURL(baseURL, 'embedding') }
  }
  if (baseURL)
    return invalidConfig('embedding', 'baseURL is only supported by openai-compatible')
  return { provider, apiKey, model }
}

export function loadProviderConfig(env: NodeJS.ProcessEnv = process.env): AiDocProviderConfig {
  return {
    chat: loadLanguageTarget(env),
    embedding: loadEmbeddingTarget(env),
  }
}

export function providerStatusOf(config: AiDocProviderConfig): AiRuntimeStatus {
  return {
    chat: config.chat ? { availability: 'configured', provider: config.chat.provider, model: config.chat.model } : { availability: 'missing', provider: null, model: null },
    embedding: config.embedding ? { availability: 'configured', provider: config.embedding.provider, model: config.embedding.model } : { availability: 'missing', provider: null, model: null },
  }
}

/** Stable identity for detecting vector indexes built with another remote endpoint. */
export function embeddingIdentitySeedOf(target: AiDocEmbeddingConfig): EmbeddingIdentitySeed {
  const endpoint = target.provider === 'openai-compatible'
    ? normalizedCompatibleBaseURL(target.baseURL, 'embedding')
    : `${target.provider}:default`

  return {
    provider: target.provider,
    model: target.model,
    endpointFingerprint: createHash('sha256').update(endpoint).digest('hex'),
  }
}
