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
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const history: ChatHistoryMessage[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
    ]
    const controller = new AbortController()
    const events: string[] = []

    await streamQuery('follow-up', 5, history, event => events.push(event.type), controller.signal)

    const init = fetchMock.mock.calls[0][1]
    if (!init)
      throw new Error('expected fetch request init')
    expect(init.signal).toBe(controller.signal)
    expect(JSON.parse(String(init.body))).toEqual({ question: 'follow-up', topK: 5, history })
    expect(events).toEqual(['token', 'done'])
  })

  it('接受 error 终态', async () => {
    const body = new Response('event: error\ndata: {"type":"error","error":"UPSTREAM_ERROR","message":"boom"}\n\n').body
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })))
    const events: string[] = []

    await streamQuery('question', 5, [], event => events.push(event.type))

    expect(events).toEqual(['error'])
  })

  it('拒绝没有 done/error 的意外断流', async () => {
    const body = new Response('event: token\ndata: {"type":"token","text":"partial"}\n\n').body
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })))

    await expect(
      streamQuery('question', 5, [], vi.fn()),
    )
      .rejects
      .toThrow('query stream ended before a terminal event')
  })

  it('拒绝终态后的额外事件', async () => {
    const body = new Response('event: done\ndata: {"type":"done"}\n\nevent: token\ndata: {"type":"token","text":"late"}\n\n').body
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })))

    await expect(
      streamQuery('question', 5, [], vi.fn()),
    )
      .rejects
      .toThrow('query stream received data after terminal event')
  })

  it('abort 时透传 AbortError 并释放 reader 锁', async () => {
    const controller = new AbortController()
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        controller.signal.addEventListener('abort', () => {
          stream.error(new DOMException('aborted', 'AbortError'))
        }, { once: true })
      },
    })
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })))

    const pending = streamQuery('question', 5, [], vi.fn(), controller.signal)
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(body.locked).toBe(false)
  })
})
