import type { ComponentContract } from '../src/core/types'
// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildIndex, EMBEDDING_DIM } from '../src/core/indexer'
import { loadIndex, persistIndex, readMeta } from '../src/core/persist'
import { Retriever } from '../src/core/retriever'

/**
 * 索引 + 持久化 + 检索集成测试。
 * embedding 用确定性 stub（按关键词置位），离线可复现，验证全链路：
 * buildIndex → persistIndex → Retriever.fromDir → retrieve 命中与阈值兜底。
 */

/** 确定性 stub embedding：把文本里出现的关键词映射到固定维度置 1，其余为 0。 */
const VOCAB = ['date', 'range', 'picker', 'button', 'click', 'disabled', 'table', 'select']
function stubEmbed(texts: string[]): Promise<number[][]> {
  return Promise.resolve(texts.map((t) => {
    const vec = Array.from({ length: EMBEDDING_DIM }).fill(0)
    const lower = t.toLowerCase()
    VOCAB.forEach((word, i) => {
      if (lower.includes(word))
        vec[i] = 1
    })
    return vec
  }))
}

function contract(name: string, desc: string): ComponentContract {
  return {
    name,
    packageName: '@moluoxixi/components',
    description: desc,
    props: [{ name: 'disabled', type: 'boolean', required: false, defaultValue: 'false', description: '禁用', typeRefs: [] }],
    emits: [{ name: 'click', payloadType: 'MouseEvent', description: '点击' }],
    slots: [],
    models: [],
    sourceFile: `packages/components/src/${name}/src/index.vue`,
    typeDefs: [],
  }
}

describe('索引与检索集成', () => {
  let dir: string
  const contracts = [
    contract('DateRangePicker', 'date range picker 日期范围选择器'),
    contract('TableSelect', 'table select 表格选择器'),
  ]

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ai-doc-idx-'))
    const result = await buildIndex(contracts, stubEmbed, 'hash-v1')
    await persistIndex(dir, result)
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('持久化写入 meta 与快照并可回读', async () => {
    const meta = await readMeta(dir)
    expect(meta).toBeTruthy()
    expect(meta!.componentCount).toBe(2)
    expect(meta!.embeddingDim).toBe(EMBEDDING_DIM)
    expect(meta!.sourceHash).toBe('hash-v1')

    const loaded = await loadIndex(dir)
    expect(loaded.snapshot).toBeTruthy()
  })

  it('相关查询命中对应组件并回带预生成示例', async () => {
    const retriever = await Retriever.fromDir(dir)
    const [qv] = await stubEmbed(['date range picker'])
    const res = await retriever.retrieve('date range picker', qv, 5)

    expect(res.empty).toBe(false)
    expect(res.chunks[0].component).toBe('DateRangePicker')
    expect(res.chunks[0].example).toContain('DateRangePicker')
  })

  it('无关查询触发阈值兜底（empty=true）', async () => {
    const retriever = await Retriever.fromDir(dir)
    const [qv] = await stubEmbed(['完全不相关的查询无任何词命中'])
    const res = await retriever.retrieve('zzz nothing matches', qv, 5)

    expect(res.empty).toBe(true)
    expect(res.chunks).toHaveLength(0)
  })

  it('索引目录缺失时 fromDir 抛错（不静默返回空）', async () => {
    await expect(Retriever.fromDir(join(dir, 'nonexistent'))).rejects.toThrow()
  })
})
