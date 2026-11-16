import type { VectorDoc } from '../src/core/vector-store'
import { describe, expect, it } from 'vitest'
import { EMBEDDING_DIM } from '../src/core/embedder'
import { createVectorStore, VECTOR_STORE_KINDS } from '../src/core/vector-store'

/** 构造一条维度合法的入库文档；vec 不足维度时用 0 补齐，超出则报错由被测逻辑处理。 */
function makeDoc(component: string, body: string, vec: number[]): VectorDoc {
  const embedding = vec.length === EMBEDDING_DIM
    ? vec
    : [...vec, ...Array.from({ length: EMBEDDING_DIM - vec.length }).fill(0)]
  return {
    component,
    packageName: '@x/c',
    docPath: `${component}.md`,
    body,
    example: `<${component} />`,
    embedding,
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
    const dp = Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 0 ? 1 : 0))
    const btn = Array.from({ length: EMBEDDING_DIM }, (_, i) => (i === 1 ? 1 : 0))
    await store.build([
      makeDoc('DateRangePicker', '日期范围选择器 支持快捷选项', dp),
      makeDoc('Button', '按钮 主按钮 次按钮', btn),
    ])
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
      body: 'x',
      example: '<Bad />',
      embedding: [1, 2, 3], // 远小于 EMBEDDING_DIM
    }
    await expect(store.build([bad])).rejects.toThrow(/embedding dim mismatch/)
  })

  it('未 build 即 search 显式抛错，不伪装无命中', async () => {
    const store = await createVectorStore('orama')
    const v = Array.from({ length: EMBEDDING_DIM }).fill(0)
    await expect(store.search('任意查询', v, 5)).rejects.toThrow(/not built/)
  })
})
