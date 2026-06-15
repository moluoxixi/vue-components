import type { IndexMeta } from '../src/core/indexer'
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { IndexStateManager } from '../src/core/index-state'

const META: IndexMeta = {
  builtAt: '2026-01-01T00:00:00.000Z',
  componentCount: 3,
  sourceHash: 'h',
  embeddingDim: 1536,
}

describe('indexStateManager 状态机', () => {
  it('初始为 idle，snapshot 各字段为 null', () => {
    const m = new IndexStateManager()
    const s = m.snapshot()
    expect(s.status).toBe('idle')
    expect(s.meta).toBeNull()
    expect(s.error).toBeNull()
    expect(m.isReady()).toBe(false)
  })

  it('hydrate 有 meta → ready', () => {
    const m = new IndexStateManager()
    m.hydrate(META)
    expect(m.isReady()).toBe(true)
    expect(m.snapshot().meta).toEqual(META)
  })

  it('hydrate(null) 保持 idle', () => {
    const m = new IndexStateManager()
    m.hydrate(null)
    expect(m.isReady()).toBe(false)
  })

  it('runBuild 成功 → ready 并暴露 meta', async () => {
    const m = new IndexStateManager()
    const meta = await m.runBuild(async () => META)
    expect(meta).toEqual(META)
    expect(m.snapshot().status).toBe('ready')
    expect(m.snapshot().meta).toEqual(META)
  })

  it('runBuild 失败 → error 状态并抛出（不伪装成功）', async () => {
    const m = new IndexStateManager()
    await expect(m.runBuild(async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    const s = m.snapshot()
    expect(s.status).toBe('error')
    expect(s.error).toBe('boom')
    expect(m.isReady()).toBe(false)
  })

  it('并发构建复用同一 in-flight Promise（单飞，build 只执行一次）', async () => {
    const m = new IndexStateManager()
    let calls = 0
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const build = vi.fn(async () => {
      calls++
      await gate
      return META
    })
    const p1 = m.runBuild(build)
    const p2 = m.runBuild(build)
    expect(m.snapshot().status).toBe('building')
    release()
    await Promise.all([p1, p2])
    expect(calls).toBe(1)
    expect(build).toHaveBeenCalledTimes(1)
  })
})
