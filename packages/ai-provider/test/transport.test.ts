import type { FetchLike, ProviderConfig } from '../server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AiProviderError,
  createAiProviderError,
  embed,
  getAiProviderErrorCause,
  streamChat,
} from '../server'

const config: ProviderConfig = {
  chatBaseUrl: 'https://up.example/v1/',
  chatApiKey: 'chat-secret',
  chatModel: 'chat-model',
  embeddingBaseUrl: 'https://up.example/v1/',
  embeddingApiKey: 'embedding-secret',
  embeddingModel: 'embedding-model',
}

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

function openStreamFrom(text: string, cancel: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    cancel,
    start(controller) {
      controller.enqueue(encoder.encode(text))
    },
  })
}

async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
  const tokens: string[] = []
  for await (const token of stream)
    tokens.push(token)
  return tokens
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamChat', () => {
  it('sends the exact URL, authorization, model, messages and signal', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(
      streamFrom('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'),
      { status: 200 },
    ))
    const controller = new AbortController()
    const messages = [{ role: 'user' as const, content: 'hello' }]

    await expect(collect(streamChat(config, messages, controller.signal, { fetch: fetchMock }))).resolves.toEqual(['ok'])
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://up.example/v1/chat/completions')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer chat-secret' })
    expect(init?.signal).toBe(controller.signal)
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'chat-model', messages, stream: true })
  })

  it('uses global fetch when no transport override is supplied', async () => {
    const fetchMock = vi.fn(async () => new Response(streamFrom('data: [DONE]'), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(collect(streamChat(config, []))).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('cancels an upstream body that remains open after DONE', async () => {
    const cancel = vi.fn()
    const fetchMock = vi.fn(async () => new Response(openStreamFrom('data: [DONE]\n\n', cancel), { status: 200 }))

    await expect(collect(streamChat(config, [], undefined, { fetch: fetchMock }))).resolves.toEqual([])
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels the reader when the caller stops consuming early', async () => {
    const cancel = vi.fn()
    const body = openStreamFrom(
      'data: {"choices":[{"delta":{"content":"first"}}]}\n\n',
      cancel,
    )
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))

    const stream = streamChat(config, [], undefined, { fetch: fetchMock })
    await expect(stream.next()).resolves.toEqual({ done: false, value: 'first' })
    await stream.return(undefined)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('joins multiline data fields and accepts bare CR event separators', async () => {
    const body = streamFrom(
      'data: {"choices":[\r'
      + 'data: {"delta":{"content":"ok"}}]}\r\r'
      + 'data: [DONE]\r\r',
    )
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))

    await expect(collect(streamChat(config, [], undefined, { fetch: fetchMock }))).resolves.toEqual(['ok'])
  })

  it('classifies HTTP failures without returning the provider body', async () => {
    const fetchMock = vi.fn(async () => new Response('chat-secret upstream detail', { status: 429 }))
    const next = streamChat(config, [], undefined, { fetch: fetchMock }).next()

    await expect(next).rejects.toMatchObject({
      code: 'UPSTREAM_HTTP_ERROR',
      retryable: true,
      status: 429,
    })
    await expect(next).rejects.not.toThrow(/chat-secret|upstream detail/)
  })

  it('marks non-retryable HTTP failures and missing bodies explicitly', async () => {
    const denied = vi.fn(async () => new Response('denied', { status: 400 }))
    await expect(streamChat(config, [], undefined, { fetch: denied }).next()).rejects.toMatchObject({
      code: 'UPSTREAM_HTTP_ERROR',
      retryable: false,
      status: 400,
    })

    const missingBody = vi.fn(async () => new Response(null, { status: 200 }))
    await expect(streamChat(config, [], undefined, { fetch: missingBody }).next())
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })
  })

  it('classifies non-abort fetch failures as retryable network errors', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(streamChat(config, [], undefined, { fetch: fetchMock }).next()).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK_ERROR',
      retryable: true,
    })
  })

  it('rejects malformed or unterminated streams as protocol errors', async () => {
    const malformed = vi.fn(async () => new Response(streamFrom('data: not-json\n\n'), { status: 200 }))
    await expect(streamChat(config, [], undefined, { fetch: malformed }).next())
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })

    const unterminated = vi.fn(async () => new Response(
      streamFrom('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      { status: 200 },
    ))
    await expect(collect(streamChat(config, [], undefined, { fetch: unterminated })))
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })
  })

  it('accepts a final DONE frame without a trailing blank line', async () => {
    const fetchMock = vi.fn(async () => new Response(streamFrom('data: [DONE]'), { status: 200 }))
    await expect(collect(streamChat(config, [], undefined, { fetch: fetchMock }))).resolves.toEqual([])
  })

  it('preserves AbortError instead of wrapping it', async () => {
    const abortError = new DOMException('stopped', 'AbortError')
    const fetchMock = vi.fn(async () => {
      throw abortError
    })
    await expect(streamChat(config, [], undefined, { fetch: fetchMock }).next()).rejects.toBe(abortError)
  })
})

describe('embed', () => {
  it('returns no vectors without making a request for empty input', async () => {
    const fetchMock = vi.fn()
    await expect(embed(config, [], undefined, { fetch: fetchMock })).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates the endpoint, body and vector count', async () => {
    const fetchMock = vi.fn<FetchLike>(async () => new Response(JSON.stringify({
      data: [{ embedding: [1, 2] }, { embedding: [3, 4] }],
    }), { status: 200 }))

    await expect(embed(config, ['a', 'b'], undefined, { fetch: fetchMock })).resolves.toEqual([[1, 2], [3, 4]])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://up.example/v1/embeddings')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer embedding-secret' })
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'embedding-model', input: ['a', 'b'] })
  })

  it('classifies embedding HTTP and network failures without response details', async () => {
    const rejected = vi.fn(async () => new Response('embedding-secret detail', { status: 503 }))
    await expect(embed(config, ['a'], undefined, { fetch: rejected })).rejects.toMatchObject({
      code: 'UPSTREAM_HTTP_ERROR',
      retryable: true,
      status: 503,
      message: 'embedding upstream 503',
    })

    const offline = vi.fn(async () => {
      throw new Error('offline')
    })
    await expect(embed(config, ['a'], undefined, { fetch: offline })).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK_ERROR',
      retryable: true,
    })
  })

  it('reports invalid response shapes and count mismatches', async () => {
    const invalidJson = vi.fn(async () => new Response('not-json', { status: 200 }))
    await expect(embed(config, ['a'], undefined, { fetch: invalidJson }))
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })

    const invalidData = vi.fn(async () => new Response('{"data":{}}', { status: 200 }))
    await expect(embed(config, ['a'], undefined, { fetch: invalidData }))
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })

    const invalidEntry = vi.fn(async () => new Response('{"data":[null]}', { status: 200 }))
    await expect(embed(config, ['a'], undefined, { fetch: invalidEntry }))
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })

    const invalid = vi.fn(async () => new Response('{"data":[{"embedding":["bad"]}]}', { status: 200 }))
    await expect(embed(config, ['a'], undefined, { fetch: invalid }))
      .rejects
      .toMatchObject({ code: 'UPSTREAM_PROTOCOL_ERROR' })

    const mismatch = vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
    await expect(embed(config, ['a'], undefined, { fetch: mismatch }))
      .rejects
      .toMatchObject({ code: 'EMBEDDING_COUNT_MISMATCH' })
  })
})

it('uses a stable typed error', () => {
  const error = new AiProviderError('UPSTREAM_NETWORK_ERROR', 'failed', { retryable: true })
  expect(error).toMatchObject({ name: 'AiProviderError', code: 'UPSTREAM_NETWORK_ERROR', retryable: true })
})

it('keeps diagnostic causes on the server-only channel', () => {
  const cause = new Error('sensitive internal URL')
  const error = createAiProviderError('UPSTREAM_NETWORK_ERROR', 'request failed', { cause })

  expect(error).not.toHaveProperty('cause')
  expect(getAiProviderErrorCause(error)).toBe(cause)
})
