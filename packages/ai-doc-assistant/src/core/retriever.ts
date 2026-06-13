import type { Orama } from '@orama/orama'
import type { IndexMeta } from './indexer'
import { create, load, search } from '@orama/orama'
import { INDEX_SCHEMA } from './indexer'
import { loadIndex } from './persist'

/** 低于该相似度视为无命中，触发上层"无依据兜底"，避免拿不相关语料硬答。 */
export const NO_MATCH_SCORE_THRESHOLD = 0.3

/** 单条检索命中。 */
export interface RetrievedChunk {
  id: string
  component: string
  packageName: string
  docPath: string
  body: string
  /** 预生成的带类型提示示例骨架（建索引时随文档存入，查询期直接回带）。 */
  example: string
  score: number
}

/** 检索结果。empty=true 表示无任何命中超过阈值，上层据此走兜底回答。 */
export interface RetrieveResult {
  chunks: RetrievedChunk[]
  empty: boolean
}

/**
 * Retriever：持有 restore 后的 Orama db 与 meta，对外提供混合检索。
 * 索引为只读语料，db 在加载后不再变更；重建索引须重新 load。
 */
export class Retriever {
  private constructor(
    private readonly db: Orama<typeof INDEX_SCHEMA>,
    readonly meta: IndexMeta,
  ) {}

  /**
   * 从持久化目录加载索引并构造 Retriever。
   * 索引缺失时 loadIndex 抛错（上层映射为 INDEX_NOT_READY），不静默返回空检索器。
   */
  static async fromDir(dir: string): Promise<Retriever> {
    const { snapshot, meta } = await loadIndex(dir)
    const db = create({ schema: INDEX_SCHEMA })
    load(db, snapshot as Parameters<typeof load>[1])
    return new Retriever(db, meta)
  }

  /**
   * 直接用内存中的索引快照构造 Retriever，省去落盘/读盘往返。
   * 用于小知识库启动即用：buildIndex 产出的 snapshot 直接恢复为可检索 db。
   */
  static fromSnapshot(snapshot: unknown, meta: IndexMeta): Retriever {
    const db = create({ schema: INDEX_SCHEMA })
    load(db, snapshot as Parameters<typeof load>[1])
    return new Retriever(db, meta)
  }

  /**
   * 混合检索：BM25 全文 + 向量语义融合，按分数降序取 topK。
   * @param queryText 原始查询文本，用于 BM25 词项匹配。
   * @param queryVector 查询文本的 embedding（维度须与索引一致，由调用方保证）。
   * @param topK 返回条数上限。
   */
  async retrieve(queryText: string, queryVector: number[], topK = 5): Promise<RetrieveResult> {
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
      body: hit.document.body as string,
      example: hit.document.example as string,
      score: hit.score,
    }))

    // 最高分都低于阈值 → 判定无可信依据，交由上层兜底
    const empty = chunks.length === 0 || chunks[0].score < NO_MATCH_SCORE_THRESHOLD

    return { chunks: empty ? [] : chunks, empty }
  }
}
