/**
 * 上游调用客户端：基于 OpenAI 兼容 API 的 chat（流式）与 embedding。
 * 使用 node 22 原生 fetch，无额外 HTTP 依赖。
 */
import type { ProviderConfig } from './ai-provider'

/** chat 消息。 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 流式 chat：逐 token yield 文本增量。
 * 上游非 2xx 时抛错（由调用方映射为 UPSTREAM_ERROR），绝不吞错或返回伪造内容。
 */
export async function* streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const resp = await fetch(`${config.chatBaseUrl}/chat/completions`, {
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
  })

  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`chat upstream ${resp.status}: ${detail.slice(0, 200)}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    buffer += decoder.decode(value, { stream: true })

    // OpenAI 流以 "data: {json}\n\n" 分帧，[DONE] 表示结束
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data:'))
      if (!line)
        continue
      const payload = line.slice('data:'.length).trim()
      if (payload === '[DONE]')
        return
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta.length > 0)
        yield delta
    }
  }
}

/**
 * 批量 embedding：输入文本数组，返回等长向量数组。
 * 上游非 2xx 抛错；返回条数与输入不一致也抛错（不静默截断/补空）。
 */
export async function embed(
  config: ProviderConfig,
  inputs: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (inputs.length === 0)
    return []

  const resp = await fetch(`${config.embeddingBaseUrl}/embeddings`, {
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
  })

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`embedding upstream ${resp.status}: ${detail.slice(0, 200)}`)
  }

  const json = await resp.json()
  const vectors: number[][] = (json?.data ?? []).map((d: { embedding: number[] }) => d.embedding)

  if (vectors.length !== inputs.length)
    throw new Error(`embedding count mismatch: expected ${inputs.length}, got ${vectors.length}`)

  return vectors
}
