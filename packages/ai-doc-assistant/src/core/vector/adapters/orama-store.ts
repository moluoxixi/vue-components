import type { Orama } from '@orama/orama'
import type { RetrievedChunk } from '../../retrieval/services/retriever'
import type { VectorDoc, VectorIndexMetadata, VectorSearchResult, VectorStore } from '../services/vector-store'
/**
 * Orama 向量存储实现（默认后端）：内存 hybrid 索引，BM25 全文 + 向量语义混合检索。
 *
 * 本模块依赖 @orama/orama，只在 vectorStore=orama（默认）且 retrieval mode=vector 时
 * 经 createVectorStore 动态 import 加载；content 默认模式完全不触及。
 *
 * 复用 indexer 的 INDEX_SCHEMA 与维度校验，保证与既有持久化快照格式一致。
 */
import { create, insertMultiple, load, save, search } from '@orama/orama'
import { createIndexSchema } from '../../indexing'
import { NO_MATCH_SCORE_THRESHOLD } from '../../retrieval/services/retriever'
import { validateEmbeddingVector } from '../validation'

/** 入库文档（example/exampleJs 为 stored-only，不参与检索打分）。 */
interface OramaIndexDoc {
  component: string
  packageName: string
  docPath: string
  source: 'internal' | 'external'
  knowledgeKey: string
  body: string
  example: string
  exampleJs: string
  embedding: number[]
}

/**
 * Orama 内存向量存储。build 建索引，search 做混合检索。
 */
export class OramaVectorStore implements VectorStore {
  readonly kind = 'orama' as const
  private db: Orama<ReturnType<typeof createIndexSchema>> | null = null
  private dimension: number | null = null

  async build(docs: VectorDoc[], metadata: VectorIndexMetadata, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const { dimension } = metadata.embeddingIdentity
    const indexDocs: OramaIndexDoc[] = docs.map((d) => {
      validateEmbeddingVector(d.embedding, dimension, `embedding for ${d.component}`)
      return {
        component: d.component,
        packageName: d.packageName,
        docPath: d.docPath,
        source: d.source,
        knowledgeKey: d.knowledgeKey,
        body: d.body,
        example: d.example,
        exampleJs: d.exampleJs,
        embedding: d.embedding,
      }
    })

    const schema = createIndexSchema(dimension)
    const db = create({ schema })
    await insertMultiple(db as Orama<typeof schema>, indexDocs)
    this.db = db
    this.dimension = dimension
  }

  snapshot(): unknown {
    if (this.db === null || this.dimension === null)
      throw new Error('orama store not built: cannot create snapshot')
    return save(this.db)
  }

  async hydrate(snapshot: unknown, metadata: VectorIndexMetadata, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const { dimension } = metadata.embeddingIdentity
    const schema = createIndexSchema(dimension)
    const db = create({ schema })
    load(db, snapshot as Parameters<typeof load>[1])
    this.db = db
    this.dimension = dimension
  }

  isReady(): boolean {
    return this.db !== null
  }

  async search(queryText: string, queryVector: number[], topK: number, signal?: AbortSignal): Promise<VectorSearchResult> {
    signal?.throwIfAborted()
    // 未构建即检索属时序错误，显式抛错（不静默返回空伪装无命中）
    if (this.db === null || this.dimension === null)
      throw new Error('orama store not built: call build() before search()')
    validateEmbeddingVector(queryVector, this.dimension, 'query embedding')

    // hybrid 模式下 search 可能返回 Promise，统一 await
    const result = await search(this.db, {
      term: queryText,
      mode: 'hybrid',
      vector: { value: queryVector, property: 'embedding' },
      similarity: 0,
      limit: topK,
    })

    const chunks: RetrievedChunk[] = result.hits.map(hit => ({
      id: String(hit.id),
      component: hit.document.component as string,
      packageName: hit.document.packageName as string,
      docPath: hit.document.docPath as string,
      source: hit.document.source as 'internal' | 'external',
      knowledgeKey: hit.document.knowledgeKey as string,
      body: hit.document.body as string,
      example: hit.document.example as string,
      exampleJs: hit.document.exampleJs as string,
      score: hit.score,
    }))

    // 最高分都低于阈值 → 判定无可信依据，交由上层兜底
    const empty = chunks.length === 0 || chunks[0].score < NO_MATCH_SCORE_THRESHOLD
    return { chunks: empty ? [] : chunks, empty }
  }
}
