import type { RetrievedChunk } from './retriever'
import type { QdrantConfig, VectorDoc, VectorSearchResult, VectorStore } from './vector-store'
/**
 * Qdrant 向量存储实现（外部后端）：通过 Qdrant REST API 做向量检索。
 *
 * 本模块零原生依赖、纯 fetch 实现，可连接任意 Qdrant 实例（本地 docker、自托管、Qdrant Cloud）。
 * 只在 vectorStore=qdrant 且 retrieval mode=vector 时经 createVectorStore 动态 import 加载；
 * content 默认模式与 orama 模式完全不触及。
 *
 * 索引策略：build 时若集合不存在则按 EMBEDDING_DIM + Cosine 距离创建，再批量 upsert 点；
 * search 时调用 /points/search 做向量近邻召回。payload 携带契约正文/示例/来源，回带给上层。
 *
 * 失败语义：HTTP 非 2xx、未 build 即 search 均显式抛错，不静默吞错或伪装无命中。
 */
import { EMBEDDING_DIM } from './embedder'
import { NO_MATCH_SCORE_THRESHOLD } from './retriever'

/** 点 payload：随向量存储的可追溯元数据与上下文来源。 */
interface QdrantPayload {
  component: string
  packageName: string
  docPath: string
  source: 'internal' | 'external'
  knowledgeKey: string
  body: string
  example: string
  exampleJs: string
}

/** Qdrant /points/search 单条命中结构（仅取用到的字段）。 */
interface QdrantScoredPoint {
  id: string | number
  score: number
  payload: QdrantPayload
}

/**
 * Qdrant 向量存储。build 建集合并 upsert，search 做向量近邻召回。
 */
export class QdrantVectorStore implements VectorStore {
  readonly kind = 'qdrant' as const
  private readonly base: string
  private readonly collection: string
  private readonly apiKey?: string
  private built = false

  constructor(config: QdrantConfig) {
    // 连接配置为系统边界输入：必填项缺失即显式抛错，不带空串继续拼 URL
    if (!config.url)
      throw new Error('qdrant config requires url')
    if (!config.collection)
      throw new Error('qdrant config requires collection')
    // 去掉末尾斜杠，统一拼接
    this.base = config.url.replace(/\/+$/, '')
    this.collection = config.collection
    this.apiKey = config.apiKey
  }

  /** 统一请求头：JSON + 可选 api-key。 */
  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    if (this.apiKey)
      h['api-key'] = this.apiKey
    return h
  }

  /** 发请求并校验状态码；非 2xx 显式抛错带响应体，便于定位（不静默降级）。 */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`qdrant ${method} ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
  }

  async build(docs: VectorDoc[]): Promise<void> {
    // 维度一致性是检索正确性前提：任一向量维度不符即显式抛错，不放行错位向量
    for (const d of docs) {
      if (d.embedding.length !== EMBEDDING_DIM) {
        throw new Error(
          `embedding dim mismatch for ${d.component}: got ${d.embedding.length}, expected ${EMBEDDING_DIM}`,
        )
      }
    }

    // 重建集合：先删后建，保证维度/距离与当前 embedder 一致（幂等，避免残留旧维度索引）
    await fetch(`${this.base}/collections/${this.collection}`, {
      method: 'DELETE',
      headers: this.headers(),
    })
    await this.request('PUT', `/collections/${this.collection}`, {
      vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
    })

    // 批量 upsert：点 id 用序号，payload 携带可追溯元数据与上下文
    const points = docs.map((d, i) => ({
      id: i,
      vector: d.embedding,
      payload: {
        component: d.component,
        packageName: d.packageName,
        docPath: d.docPath,
        source: d.source,
        knowledgeKey: d.knowledgeKey,
        body: d.body,
        example: d.example,
        exampleJs: d.exampleJs,
      } satisfies QdrantPayload,
    }))
    // wait=true 确保 upsert 落盘后再返回，避免随后 search 读到未就绪索引
    await this.request('PUT', `/collections/${this.collection}/points?wait=true`, { points })
    this.built = true
  }

  isReady(): boolean {
    return this.built
  }

  async search(_queryText: string, queryVector: number[], topK: number): Promise<VectorSearchResult> {
    // 未构建即检索属时序错误，显式抛错（不静默返回空伪装无命中）
    if (!this.built)
      throw new Error('qdrant store not built: call build() before search()')

    const result = await this.request<{ result: QdrantScoredPoint[] }>(
      'POST',
      `/collections/${this.collection}/points/search`,
      { vector: queryVector, limit: topK, with_payload: true },
    )

    const chunks: RetrievedChunk[] = result.result.map(hit => ({
      id: String(hit.id),
      component: hit.payload.component,
      packageName: hit.payload.packageName,
      docPath: hit.payload.docPath,
      source: hit.payload.source,
      knowledgeKey: hit.payload.knowledgeKey,
      body: hit.payload.body,
      example: hit.payload.example,
      exampleJs: hit.payload.exampleJs,
      score: hit.score,
    }))

    // 最高分都低于阈值 → 判定无可信依据，交由上层兜底
    const empty = chunks.length === 0 || chunks[0].score < NO_MATCH_SCORE_THRESHOLD
    return { chunks: empty ? [] : chunks, empty }
  }
}
