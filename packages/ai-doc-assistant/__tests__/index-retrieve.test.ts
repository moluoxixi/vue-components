import type { ComponentContract } from '../src/core/types'
// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MockEmbeddingModelV3 } from 'ai/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildIndex, loadIndex, persistIndex, readMeta } from '../src/core/indexing'
import { Retriever } from '../src/core/retrieval/services/retriever'

/**
 * 索引 + 持久化 + 检索集成测试。
 * embedding 使用无网络依赖的确定性 AI SDK mock（按关键词置位），验证全链路：
 * buildIndex → persistIndex → Retriever.fromDir → retrieve 命中与阈值兜底。
 */

const TEST_VECTOR_DIMENSION = 8
const IDENTITY = {
  provider: 'openai' as const,
  model: 'text-embedding-3-small',
  endpointFingerprint: 'official',
}

/** 确定性 embedding：把文本里出现的关键词映射到当前模型维度。 */
const VOCAB = ['date', 'range', 'picker', 'button', 'click', 'disabled', 'table', 'select']
function stubEmbed(texts: string[]): Promise<number[][]> {
  return Promise.resolve(texts.map((t) => {
    const vec = Array.from({ length: TEST_VECTOR_DIMENSION }).fill(0) as number[]
    const lower = t.toLowerCase()
    VOCAB.forEach((word, i) => {
      if (lower.includes(word))
        vec[i] = 1
    })
    return vec
  }))
}

const embeddingModel = new MockEmbeddingModelV3({
  doEmbed: async ({ values }) => ({
    embeddings: await stubEmbed(values),
    usage: { tokens: values.length },
    warnings: [],
  }),
})

function contract(name: string, desc: string): ComponentContract {
  return {
    name,
    packageName: '@moluoxixi/components',
    description: desc,
    props: [{ name: 'disabled', type: 'boolean', required: false, defaultValue: 'false', description: '禁用', typeRefs: [] }],
    emits: [{ name: 'click', payloadType: 'MouseEvent', description: '点击', typeRefs: [] }],
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
    const result = await buildIndex(contracts, embeddingModel, 'hash-v1', IDENTITY)
    await persistIndex(dir, result)
  })

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('持久化写入 meta 与快照并可回读', async () => {
    const meta = await readMeta(dir)
    expect(meta).toBeTruthy()
    expect(meta!.componentCount).toBe(2)
    expect(meta!.embeddingIdentity).toEqual({ ...IDENTITY, dimension: TEST_VECTOR_DIMENSION })
    expect(meta!.sourceHash).toBe('hash-v1')

    const loaded = await loadIndex(dir)
    expect(loaded.snapshot).toBeTruthy()
  })

  it('相关查询命中对应组件并回带预生成示例', async () => {
    const retriever = await Retriever.fromDir(dir, IDENTITY)
    const [qv] = await stubEmbed(['date range picker'])
    const res = await retriever.retrieve('date range picker', qv, 5)

    expect(res.empty).toBe(false)
    expect(res.chunks[0].component).toBe('DateRangePicker')
    expect(res.chunks[0].example).toContain('DateRangePicker')
  })

  it('无关查询触发阈值兜底（empty=true）', async () => {
    const retriever = await Retriever.fromDir(dir, IDENTITY)
    const [qv] = await stubEmbed(['完全不相关的查询无任何词命中'])
    const res = await retriever.retrieve('zzz nothing matches', qv, 5)

    expect(res.empty).toBe(true)
    expect(res.chunks).toHaveLength(0)
  })

  it('索引目录缺失时 fromDir 抛错（不静默返回空）', async () => {
    await expect(Retriever.fromDir(join(dir, 'nonexistent'))).rejects.toThrow()
  })

  it('embedding identity 变化后拒绝恢复旧索引', async () => {
    await expect(Retriever.fromDir(dir, {
      ...IDENTITY,
      model: 'text-embedding-3-large',
    })).rejects.toThrow(/identity is stale/)
  })
})
