import type { RetrievedChunk } from '../../retrieval/services/retriever'
import type {
  QdrantConfig,
  VectorDoc,
  VectorIndexMetadata,
  VectorSearchResult,
  VectorStore,
} from '../services/vector-store'
/**
 * Qdrant 向量存储实现（外部后端）：通过 Qdrant REST API 做向量检索。
 *
 * 本模块零原生依赖、纯 fetch 实现，可连接任意 Qdrant 实例（本地 docker、自托管、Qdrant Cloud）。
 * 只在 vectorStore=qdrant 且 retrieval mode=vector 时经 createVectorStore 动态 import 加载；
 * content 默认模式与 orama 模式完全不触及。
 *
 * 索引策略：build 时按远程模型的实际维度 + Cosine 距离重建集合，再批量 upsert 点；
 * search 时调用 /points/search 做向量近邻召回。payload 携带契约正文/示例/来源，回带给上层。
 *
 * 失败语义：HTTP 非 2xx、未 build 即 search 均显式抛错，不静默吞错或伪装无命中。
 */
import { NO_MATCH_SCORE_THRESHOLD } from '../../retrieval/services/retriever'
import { validateEmbeddingVector } from '../validation'

/** 点 payload：随向量存储的可追溯元数据与上下文来源。 */
interface QdrantDocumentPayload {
  kind: 'document'
  component: string
  packageName: string
  docPath: string
  source: 'internal' | 'external'
  knowledgeKey: string
  body: string
  example: string
  exampleJs: string
}

interface QdrantMetadataPayload {
  kind: typeof QDRANT_METADATA_KIND
  schemaVersion: typeof QDRANT_METADATA_VERSION
  sourceHash: string
  embeddingIdentity: VectorIndexMetadata['embeddingIdentity']
}

interface QdrantPoint {
  id: string | number
  vector: number[]
  payload: QdrantDocumentPayload | QdrantMetadataPayload
}

/** Qdrant /points/search 单条命中结构（仅取用到的字段）。 */
interface QdrantScoredPoint {
  id: string | number
  score: number
  payload: QdrantDocumentPayload
}

interface QdrantStoredPoint {
  payload?: unknown
}

interface QdrantCollectionInfo {
  result?: {
    config?: {
      params?: {
        vectors?: { size?: number }
      }
    }
  }
}

const QDRANT_METADATA_POINT_ID = '00000000-0000-0000-0000-000000000000'
const QDRANT_METADATA_KIND = 'ai-doc-index-metadata'
const QDRANT_METADATA_VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function matchesPersistedMetadata(value: unknown, expected: VectorIndexMetadata): boolean {
  if (!isRecord(value) || value.kind !== QDRANT_METADATA_KIND
    || value.schemaVersion !== QDRANT_METADATA_VERSION
    || value.sourceHash !== expected.sourceHash
    || !isRecord(value.embeddingIdentity)) {
    return false
  }
  const identity = value.embeddingIdentity
  return identity.provider === expected.embeddingIdentity.provider
    && identity.model === expected.embeddingIdentity.model
    && identity.endpointFingerprint === expected.embeddingIdentity.endpointFingerprint
    && identity.dimension === expected.embeddingIdentity.dimension
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
  private dimension: number | null = null

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
  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`qdrant ${method} ${path} failed: ${res.status} ${text}`)
    }
    return res.json() as Promise<T>
  }

  async build(docs: VectorDoc[], metadata: VectorIndexMetadata, signal?: AbortSignal): Promise<void> {
    this.built = false
    this.dimension = null
    const { dimension } = metadata.embeddingIdentity
    for (const d of docs) {
      validateEmbeddingVector(d.embedding, dimension, `embedding for ${d.component}`)
    }

    // 重建集合：先删后建，保证 Provider/model/维度切换后旧向量绝不会继续被查询。
    await this.request('DELETE', `/collections/${this.collection}`, undefined, signal)
    await this.request('PUT', `/collections/${this.collection}`, {
      vectors: { size: dimension, distance: 'Cosine' },
    }, signal)

    // 批量 upsert：点 id 用序号，payload 携带可追溯元数据与上下文
    const points: QdrantPoint[] = docs.map((d, i) => ({
      id: i,
      vector: d.embedding,
      payload: {
        kind: 'document',
        component: d.component,
        packageName: d.packageName,
        docPath: d.docPath,
        source: d.source,
        knowledgeKey: d.knowledgeKey,
        body: d.body,
        example: d.example,
        exampleJs: d.exampleJs,
      } satisfies QdrantDocumentPayload,
    }))
    points.push({
      id: QDRANT_METADATA_POINT_ID,
      vector: Array.from({ length: dimension }, (_, index) => index === 0 ? 1 : 0),
      payload: {
        kind: QDRANT_METADATA_KIND,
        schemaVersion: QDRANT_METADATA_VERSION,
        sourceHash: metadata.sourceHash,
        embeddingIdentity: metadata.embeddingIdentity,
      },
    })
    // wait=true 确保 upsert 落盘后再返回，避免随后 search 读到未就绪索引
    await this.request('PUT', `/collections/${this.collection}/points?wait=true`, { points }, signal)
    this.dimension = dimension
    this.built = true
  }

  snapshot(): null {
    if (!this.built || this.dimension === null)
      throw new Error('qdrant store not built: cannot create snapshot')
    return null
  }

  async hydrate(_snapshot: unknown, metadata: VectorIndexMetadata, signal?: AbortSignal): Promise<void> {
    this.built = false
    this.dimension = null
    const { dimension } = metadata.embeddingIdentity
    const info = await this.request<QdrantCollectionInfo>(
      'GET',
      `/collections/${this.collection}`,
      undefined,
      signal,
    )
    const actualDimension = info.result?.config?.params?.vectors?.size
    if (actualDimension !== dimension) {
      throw new Error(
        `qdrant collection dimension mismatch: expected ${dimension}, got ${String(actualDimension)}`,
      )
    }
    const metadataPoints = await this.request<{ result?: QdrantStoredPoint[] }>(
      'POST',
      `/collections/${this.collection}/points`,
      { ids: [QDRANT_METADATA_POINT_ID], with_payload: true, with_vector: false },
      signal,
    )
    if (!matchesPersistedMetadata(metadataPoints.result?.[0]?.payload, metadata)) {
      throw new Error(
        'qdrant collection metadata mismatch: embedding identity or source hash changed; rebuild the index',
      )
    }
    this.dimension = dimension
    this.built = true
  }

  isReady(): boolean {
    return this.built
  }

  async search(_queryText: string, queryVector: number[], topK: number, signal?: AbortSignal): Promise<VectorSearchResult> {
    // 未构建即检索属时序错误，显式抛错（不静默返回空伪装无命中）
    if (!this.built || this.dimension === null)
      throw new Error('qdrant store not built: call build() before search()')
    validateEmbeddingVector(queryVector, this.dimension, 'query embedding')

    const result = await this.request<{ result: QdrantScoredPoint[] }>(
      'POST',
      `/collections/${this.collection}/points/search`,
      {
        vector: queryVector,
        limit: topK,
        with_payload: true,
        filter: { must: [{ key: 'kind', match: { value: 'document' } }] },
      },
      signal,
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
