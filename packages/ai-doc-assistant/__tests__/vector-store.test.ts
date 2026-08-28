import type { VectorDoc, VectorIndexMetadata } from '../src/core/vector-store'
import { describe, expect, it } from 'vitest'
import { createVectorStore, VECTOR_STORE_KINDS } from '../src/core/vector-store'

const TEST_VECTOR_DIMENSION = 3
const METADATA: VectorIndexMetadata = {
  sourceHash: 'source-v1',
  embeddingIdentity: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    endpointFingerprint: 'official',
    dimension: TEST_VECTOR_DIMENSION,
  },
}

function makeDoc(component: string, body: string, vec: number[]): VectorDoc {
  return {
    component,
    packageName: '@x/c',
    docPath: `${component}.md`,
    source: 'internal',
    knowledgeKey: `internal:@x/c:${component}`,
    body,
    example: `<${component} />`,
    exampleJs: `<${component} />`,
    embedding: vec,
  }
}

describe('createVectorStore 工厂', () => {
  it('orama 为合法后端，返回 kind=orama 的实例', async () => {
    const store = await createVectorStore('orama')
    expect(store.kind).toBe('orama')
    expect(store.isReady()).toBe(false)
  })

  it('vECTOR_STORE_KINDS 包含 orama 默认后端', () => {
    expect(VECTOR_STORE_KINDS).toContain('orama')
  })

  it('非法后端标识显式抛错，不静默回落默认', async () => {
    // @ts-expect-error 故意传未知值，验证系统边界校验
    await expect(createVectorStore('faiss')).rejects.toThrow(/invalid vector store/)
  })

  it('vECTOR_STORE_KINDS 包含 qdrant 后端', () => {
    expect(VECTOR_STORE_KINDS).toContain('qdrant')
  })

  it('qdrant 为合法后端，但缺连接配置时显式抛错，不静默回落', async () => {
    await expect(createVectorStore('qdrant')).rejects.toThrow(/requires connection config/)
  })
})

describe('oramaVectorStore 构建与检索', () => {
  it('build 后 isReady 为真，命中查询返回对应组件', async () => {
    const store = await createVectorStore('orama')
    // 用正交单位向量区分两条文档：DatePicker 走向量分量 0，Button 走分量 1
    const dp = Array.from({ length: TEST_VECTOR_DIMENSION }, (_, i) => (i === 0 ? 1 : 0))
    const btn = Array.from({ length: TEST_VECTOR_DIMENSION }, (_, i) => (i === 1 ? 1 : 0))
    await store.build([
      makeDoc('DateRangePicker', '日期范围选择器 支持快捷选项', dp),
      makeDoc('Button', '按钮 主按钮 次按钮', btn),
    ], METADATA)
    expect(store.isReady()).toBe(true)

    // 全文词项 + 同向量 → 命中 DateRangePicker
    const res = await store.search('日期范围选择器', dp, 5)
    expect(res.empty).toBe(false)
    expect(res.chunks[0].component).toBe('DateRangePicker')
    expect(res.chunks[0].example).toBe('<DateRangePicker />')
  })

  it('维度不符的向量在 build 阶段显式抛错', async () => {
    const store = await createVectorStore('orama')
    const bad: VectorDoc = {
      component: 'Bad',
      packageName: '@x/c',
      docPath: 'Bad.md',
      source: 'internal',
      knowledgeKey: 'internal:@x/c:Bad',
      body: 'x',
      example: '<Bad />',
      exampleJs: '<Bad />',
      embedding: [1, 2],
    }
    await expect(store.build([bad], METADATA)).rejects.toThrow(/dim mismatch/)
  })

  it('未 build 即 search 显式抛错，不伪装无命中', async () => {
    const store = await createVectorStore('orama')
    const v = Array.from({ length: TEST_VECTOR_DIMENSION }).fill(0) as number[]
    await expect(store.search('任意查询', v, 5)).rejects.toThrow(/not built/)
  })

  it('snapshot 可恢复为同维度的可查询 Orama store', async () => {
    const source = await createVectorStore('orama')
    const vector = [1, 0, 0]
    await source.build([makeDoc('Restored', '可恢复文档', vector)], METADATA)

    const restored = await createVectorStore('orama')
    await restored.hydrate(source.snapshot(), METADATA)
    const result = await restored.search('可恢复文档', vector, 1)

    expect(restored.isReady()).toBe(true)
    expect(result.chunks[0].component).toBe('Restored')
  })
})
