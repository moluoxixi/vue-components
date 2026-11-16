import type { SseEvent } from '../src/shared/protocol'
// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { encodeSseEvent, parseSseFrame } from '../src/shared/protocol'

/**
 * Protocol 测试：SSE 编解码往返一致性 + 错误事件契约稳定性。
 */
describe('sSE 编解码', () => {
  const cases: SseEvent[] = [
    { type: 'sources', sources: [{ component: 'Foo', packageName: '@p/foo', docPath: 'a.vue', score: 0.9 }] },
    { type: 'token', text: 'hello' },
    { type: 'example', code: '<Foo/>', lang: 'vue' },
    { type: 'done' },
    { type: 'error', error: 'UPSTREAM_ERROR', message: 'boom' },
  ]

  it('每种事件编码后能解析回等价对象', () => {
    for (const ev of cases) {
      const frame = encodeSseEvent(ev)
      expect(frame).toContain(`event: ${ev.type}`)
      expect(frame.endsWith('\n\n')).toBe(true)
      const decoded = parseSseFrame(frame)
      expect(decoded).toEqual(ev)
    }
  })

  it('无 data 行的 frame 返回 null', () => {
    expect(parseSseFrame('event: ping\n\n')).toBeNull()
  })
})
