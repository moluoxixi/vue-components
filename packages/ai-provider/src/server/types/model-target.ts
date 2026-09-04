interface ModelTargetBase {
  apiKey: string
  model: string
}

interface OpenAIModelTarget extends ModelTargetBase {
  provider: 'openai'
}

interface AnthropicModelTarget extends ModelTargetBase {
  provider: 'anthropic'
}

interface GoogleModelTarget extends ModelTargetBase {
  provider: 'google'
}

interface OpenAICompatibleModelTarget extends ModelTargetBase {
  baseURL: string
  provider: 'openai-compatible'
}

export type LanguageModelTarget
  = | OpenAIModelTarget
    | AnthropicModelTarget
    | GoogleModelTarget
    | OpenAICompatibleModelTarget

export type EmbeddingModelTarget
  = | OpenAIModelTarget
    | GoogleModelTarget
    | OpenAICompatibleModelTarget
