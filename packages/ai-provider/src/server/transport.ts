import type { AiProviderError, ChatMessage } from '../shared'
import type { ProviderConfig } from './config'
import { createAiProviderError } from './error'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface ProviderTransportOptions {
  fetch?: FetchLike
}

function endpoint(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${pathname}`
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

async function request(
  operation: 'chat' | 'embedding',
  url: string,
  init: RequestInit,
  options: ProviderTransportOptions,
): Promise<Response> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  try {
    return await fetchImpl(url, init)
  }
  catch (error) {
    if (isAbortError(error))
      throw error
    throw createAiProviderError(
      'UPSTREAM_NETWORK_ERROR',
      `${operation} upstream request failed`,
      { cause: error, retryable: true },
    )
  }
}

function protocolError(operation: 'chat' | 'embedding', cause?: unknown): AiProviderError {
  return createAiProviderError(
    'UPSTREAM_PROTOCOL_ERROR',
    `${operation} upstream returned an invalid response`,
    { cause },
  )
}

function parseChatFrame(frame: string): { done: boolean, token?: string } {
  const data = frame
    .split(/\r\n|\r|\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).replace(/^ /, ''))
    .join('\n')
  if (!data)
    return { done: false }

  const payload = data.trim()
  if (payload === '[DONE]')
    return { done: true }

  try {
    const parsed: unknown = JSON.parse(payload)
    if (typeof parsed !== 'object' || parsed === null)
      return { done: false }

    const choices = Reflect.get(parsed, 'choices')
    if (!Array.isArray(choices) || choices.length === 0)
      return { done: false }

    const delta = typeof choices[0] === 'object' && choices[0] !== null
      ? Reflect.get(choices[0], 'delta')
      : undefined
    const content = typeof delta === 'object' && delta !== null
      ? Reflect.get(delta, 'content')
      : undefined
    return typeof content === 'string' && content.length > 0
      ? { done: false, token: content }
      : { done: false }
  }
  catch (error) {
    throw protocolError('chat', error)
  }
}

/** Stream text deltas from an OpenAI-compatible chat completion. */
export async function* streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
  options: ProviderTransportOptions = {},
): AsyncGenerator<string> {
  const response = await request('chat', endpoint(config.chatBaseUrl, '/chat/completions'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${config.chatApiKey}`,
    },
    body: JSON.stringify({
      model: config.chatModel,
      messages,
      stream: true,
    }),
    signal,
  }, options)

  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw createAiProviderError(
      'UPSTREAM_HTTP_ERROR',
      `chat upstream ${response.status}`,
      { retryable: isRetryableStatus(response.status), status: response.status },
    )
  }
  if (!response.body)
    throw protocolError('chat')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        if (buffer.trim()) {
          const finalFrame = parseChatFrame(buffer)
          if (finalFrame.token)
            yield finalFrame.token
          if (finalFrame.done) {
            completed = true
            return
          }
        }
        throw protocolError('chat')
      }

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split(/\r\n\r\n|\r\r|\n\n/)
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const parsed = parseChatFrame(frame)
        if (parsed.token)
          yield parsed.token
        if (parsed.done) {
          await reader.cancel().catch(() => {})
          completed = true
          return
        }
      }
    }
  }
  finally {
    if (!completed)
      await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function decodeEmbeddingResponse(value: unknown): number[][] {
  if (typeof value !== 'object' || value === null)
    throw protocolError('embedding')
  const data = Reflect.get(value, 'data')
  if (!Array.isArray(data))
    throw protocolError('embedding')

  return data.map((entry) => {
    if (typeof entry !== 'object' || entry === null)
      throw protocolError('embedding')
    const embedding = Reflect.get(entry, 'embedding')
    if (!Array.isArray(embedding) || !embedding.every(item => typeof item === 'number'))
      throw protocolError('embedding')
    return embedding
  })
}

/** Request embeddings from an OpenAI-compatible endpoint. */
export async function embed(
  config: ProviderConfig,
  inputs: string[],
  signal?: AbortSignal,
  options: ProviderTransportOptions = {},
): Promise<number[][]> {
  if (inputs.length === 0)
    return []

  const response = await request('embedding', endpoint(config.embeddingBaseUrl, '/embeddings'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${config.embeddingApiKey}`,
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: inputs,
    }),
    signal,
  }, options)

  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw createAiProviderError(
      'UPSTREAM_HTTP_ERROR',
      `embedding upstream ${response.status}`,
      { retryable: isRetryableStatus(response.status), status: response.status },
    )
  }

  let json: unknown
  try {
    json = await response.json()
  }
  catch (error) {
    throw protocolError('embedding', error)
  }
  const vectors = decodeEmbeddingResponse(json)

  if (vectors.length !== inputs.length) {
    throw createAiProviderError(
      'EMBEDDING_COUNT_MISMATCH',
      `embedding count mismatch: expected ${inputs.length}, got ${vectors.length}`,
    )
  }

  return vectors
}
