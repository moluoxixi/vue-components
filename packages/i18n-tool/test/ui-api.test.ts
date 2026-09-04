import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamTranslation } from '../src/ui/App/services'

function streamFrom(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

const request = {
  scanId: '00000000-0000-4000-8000-000000000001',
  targetLocale: 'zh-CN',
  unitIds: ['unit'],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uI translation stream', () => {
  it('decodes events and requires exactly one terminal event', async () => {
    const body = [
      'data: {"type":"progress","completed":1,"total":1}',
      '',
      'data: {"type":"done"}',
      '',
    ].join('\n')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamFrom(body), { status: 200 })))
    const events: string[] = []

    await streamTranslation(request, event => events.push(event.type))
    expect(events).toEqual(['progress', 'done'])
  })

  it('rejects EOF without a terminal and events after a terminal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamFrom(
      'data: {"type":"progress","completed":1,"total":1}\n\n',
    ), { status: 200 })))
    await expect(streamTranslation(request, () => {})).rejects.toThrow(/without a terminal/)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamFrom(
      'data: {"type":"done"}\n\ndata: {"type":"progress","completed":1,"total":1}\n\n',
    ), { status: 200 })))
    await expect(streamTranslation(request, () => {})).rejects.toThrow(/after its terminal/)
  })

  it('preserves AbortError', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('stopped', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort()
      throw abortError
    }))

    await expect(streamTranslation(request, () => {}, controller.signal)).rejects.toBe(abortError)
  })
})
