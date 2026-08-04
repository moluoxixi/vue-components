import type { ChatHistoryMessage } from '../src/shared/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamQuery } from '../src/ui/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('streamQuery', () => {
  it('发送历史与 signal，并解析跨 CRLF 分块的 SSE', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: token\r\ndata: {"type":"token","text":"o'))
        controller.enqueue(encoder.encode('k"}\r\n\r\nevent: done\r\ndata: {"type":"done"}\r\n\r\n'))
        controller.close()
      },
    })
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const history: ChatHistoryMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
    ]
    const controller = new AbortController()
    const events: string[] = []

    await streamQuery('follow-up', 5, history, event => events.push(event.type), controller.signal)

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal).toBe(controller.signal)
    expect(JSON.parse(String(init.body))).toEqual({ question: 'follow-up', topK: 5, history })
    expect(events).toEqual(['token', 'done'])
  })
})
