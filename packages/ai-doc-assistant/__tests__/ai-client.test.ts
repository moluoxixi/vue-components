import type { ProviderConfig } from '../src/server/ai-provider'
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { embed, streamChat } from '../src/server/ai-client'

const CONFIG: ProviderConfig = {
  chatBaseUrl: 'https://up.example/v1',
  chatApiKey: 'k-chat',
  chatModel: 'm-chat',
  embeddingBaseUrl: 'https://up.example/v1',
  embeddingApiKey: 'k-embed',
  embeddingModel: 'm-embed',
}

/** 把字符串转成一个 ReadableStream（模拟 fetch resp.body）。 */
function streamFrom(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text))
      controller.close()
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('streamChat 流式 chat', () => {
  it('解析 OpenAI data 帧，逐 token yield，[DONE] 结束', async () => {
    const body = streamFrom(
      'data: {"choices":[{"delta":{"content":"你"}}]}\n\n'
      + 'data: {"choices":[{"delta":{"content":"好"}}]}\n\n'
      + 'data: [DONE]\n\n',
    )
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))

    const tokens: string[] = []
    for await (const t of streamChat(CONFIG, [{ role: 'user', content: 'hi' }]))
      tokens.push(t)
    expect(tokens).toEqual(['你', '好'])
  })

  it('上游非 2xx 抛错（不吞错）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 500 })))
    const gen = streamChat(CONFIG, [{ role: 'user', content: 'hi' }])
    await expect(gen.next()).rejects.toThrow(/chat upstream 500/)
  })

  it('把 messages 与 AbortSignal 原样传给上游 fetch', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(streamFrom('data: [DONE]\r\n\r\n'), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const messages = [
      { role: 'system' as const, content: 'system' },
      { role: 'user' as const, content: 'question' },
    ]

    for await (const _token of streamChat(CONFIG, messages, controller.signal)) {
      // no token expected
    }

    const init = fetchMock.mock.calls[0][1]
    if (!init)
      throw new Error('expected fetch request init')
    expect(init.signal).toBe(controller.signal)
    expect(JSON.parse(String(init.body)).messages).toEqual(messages)
  })
})

describe('embed 批量 embedding', () => {
  it('空输入直接返回空数组，不发请求', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await embed(CONFIG, [])).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('正常返回等长向量数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [{ embedding: [1, 2] }, { embedding: [3, 4] }] }),
      { status: 200 },
    )))
    const vecs = await embed(CONFIG, ['a', 'b'])
    expect(vecs).toEqual([[1, 2], [3, 4]])
  })

  it('上游非 2xx 抛错', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 429 })))
    await expect(embed(CONFIG, ['a'])).rejects.toThrow(/embedding upstream 429/)
  })

  it('返回条数与输入不一致抛错（不静默截断/补空）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: [{ embedding: [1] }] }),
      { status: 200 },
    )))
    await expect(embed(CONFIG, ['a', 'b'])).rejects.toThrow(/count mismatch/)
  })
})
