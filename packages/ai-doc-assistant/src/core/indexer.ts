import type { Orama } from '@orama/orama'
import type { EmbedFn } from './embedder'
import type { ComponentContract } from './types'
import { create, insertMultiple, save } from '@orama/orama'
import { EMBEDDING_DIM } from './embedder'
import { renderExample, renderSearchableDoc } from './generator'

export { EMBEDDING_DIM }

/** 索引文档 schema。embedding 为固定维向量，body 走 BM25 全文。 */
export const INDEX_SCHEMA = {
  component: 'string',
  packageName: 'string',
  docPath: 'string',
  body: 'string',
  embedding: `vector[${EMBEDDING_DIM}]`,
} as const

/** 索引内单条文档。example/exampleJs 为预生成双语言示例（stored-only，不参与检索）。 */
export interface IndexDoc {
  component: string
  packageName: string
  docPath: string
  body: string
  /** TS 版示例骨架（向后兼容字段，等于双码的 ts）。 */
  example: string
  /** JS 版示例骨架（剥离类型，供前端切换查看/复制）。 */
  exampleJs: string
  embedding: number[]
}

/** 索引构建产物：持久化数据 + 元信息。 */
export interface BuildResult {
  /** Orama save() 的可序列化快照。 */
  snapshot: unknown
  meta: IndexMeta
}

/** 索引元信息。 */
export interface IndexMeta {
  builtAt: string
  componentCount: number
  sourceHash: string
  embeddingDim: number
}

/**
 * 由组件契约构建知识库索引。
 * @param contracts 组件契约列表（extractor 产出）。
 * @param embed 批量 embedding 函数（ai-provider 注入）。
 * @param sourceHash 源码指纹，写入元信息用于 stale 检测。
 * @returns 可持久化快照 + 元信息。
 *
 * 失败语义：embedding 数量与文档数不一致时抛错（不静默补齐/截断），避免向量错位污染检索。
 */
export async function buildIndex(
  contracts: ComponentContract[],
  embed: EmbedFn,
  sourceHash: string,
): Promise<BuildResult> {
  const docs = contracts.map((c) => {
    const exampleCode = renderExample(c)
    return {
      component: c.name,
      packageName: c.packageName,
      docPath: c.sourceFile,
      body: renderSearchableDoc(c),
      example: exampleCode.ts,
      exampleJs: exampleCode.js,
    }
  })

  const embeddings = await embed(docs.map(d => d.body))
  if (embeddings.length !== docs.length) {
    throw new Error(
      `embedding count mismatch: got ${embeddings.length}, expected ${docs.length}`,
    )
  }

  const db = create({ schema: INDEX_SCHEMA })
  const indexDocs: IndexDoc[] = docs.map((d, i) => {
    const vec = embeddings[i]
    if (vec.length !== EMBEDDING_DIM) {
      throw new Error(
        `embedding dim mismatch for ${d.component}: got ${vec.length}, expected ${EMBEDDING_DIM}`,
      )
    }
    return { ...d, embedding: vec }
  })
  await insertMultiple(db as Orama<typeof INDEX_SCHEMA>, indexDocs)

  return {
    snapshot: save(db as Orama<typeof INDEX_SCHEMA>),
    meta: {
      builtAt: new Date().toISOString(),
      componentCount: contracts.length,
      sourceHash,
      embeddingDim: EMBEDDING_DIM,
    },
  }
}
