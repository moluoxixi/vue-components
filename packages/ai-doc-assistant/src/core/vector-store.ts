/**
 * 向量存储抽象层（ADR-0007 扩展缝）：把「向量索引与检索」从具体后端解耦。
 *
 * 设计动机：当前默认 Orama 内存索引适配小~中知识库；知识库涨到几万项以上时，
 * 可切换 Qdrant 等外部向量库，而无需改动 VectorStrategy 与上层链路。
 * VectorStrategy 只依赖本接口，不感知具体存储。
 *
 * 切换入口：环境变量 AI_DOC_VECTOR_STORE 或 plugin/Context options.vectorStore，默认 orama。
 * 外部后端（qdrant）的连接串/密钥经 VectorStoreConfig 注入，作为系统边界显式校验。
 * 仅在 retrieval mode=vector 时才会构建向量存储；content 默认模式完全不触及本层。
 */
import type { RetrievedChunk } from './retriever'

/** 待入库的单条文档：契约正文 + 预生成示例 + 已编码向量。 */
export interface VectorDoc {
  component: string
  packageName: string
  docPath: string
  /** 契约正文（自然语言化），既参与全文也是上下文来源。 */
  body: string
  /** 带类型提示的示例骨架（stored-only，不参与检索打分）。 */
  example: string
  /** body 的 embedding 向量（维度由 embedder 决定，调用方保证一致）。 */
  embedding: number[]
}

/** 向量检索结果。empty=true 表示无命中超过阈值，上层据此走无依据兜底。 */
export interface VectorSearchResult {
  chunks: RetrievedChunk[]
  empty: boolean
}

/** 向量存储后端标识。orama=内存（默认）；qdrant=外部向量库。 */
export type VectorStoreKind = 'orama' | 'qdrant'

/** 合法后端集合，用于边界校验。 */
export const VECTOR_STORE_KINDS: readonly VectorStoreKind[] = ['orama', 'qdrant']

/**
 * Qdrant 连接配置（系统边界输入）。
 * url 必填（如 http://localhost:6333）；collection 必填；apiKey 可选（Qdrant Cloud 需要）。
 */
export interface QdrantConfig {
  url: string
  collection: string
  apiKey?: string
}

/** 各外部后端的连接配置容器。content/orama 不需要任何配置。 */
export interface VectorStoreConfig {
  qdrant?: QdrantConfig
}

/**
 * 向量存储接口。VectorStrategy 启动时选定一种实现，build 后提供 search。
 *
 * 生命周期：build（一次性建索引）→ isReady → search（多次只读检索）。
 * 失败语义：未 build 即 search 须显式抛错，不静默返回空伪装无命中。
 */
export interface VectorStore {
  /** 后端标识。 */
  readonly kind: VectorStoreKind
  /**
   * 用已编码文档构建索引。
   * @param docs 带 embedding 的文档列表（维度一致性由调用方保证）。
   */
  build: (docs: VectorDoc[]) => Promise<void>
  /** 是否已构建就绪（未就绪时上层映射 INDEX_NOT_READY）。 */
  isReady: () => boolean
  /**
   * 混合检索：向量语义（必）+ 全文（后端支持时）融合，按分数降序取 topK。
   * @param queryText 原始查询文本，用于全文词项匹配（部分后端不参与打分）。
   * @param queryVector 查询文本 embedding（维度须与索引一致）。
   * @param topK 返回条数上限。
   */
  search: (queryText: string, queryVector: number[], topK: number) => Promise<VectorSearchResult>
}

/**
 * 按后端标识创建向量存储。各后端经动态 import 加载，使重依赖只在用到时进 bundle。
 * kind 为系统边界输入，非法值显式抛错（不静默回落默认，避免配置笔误被吞掉）。
 * @param kind 后端标识。
 * @param config 外部后端连接配置；qdrant 必须提供 config.qdrant，否则显式抛错。
 */
export async function createVectorStore(
  kind: VectorStoreKind,
  config?: VectorStoreConfig,
): Promise<VectorStore> {
  if (kind === 'orama') {
    const { OramaVectorStore } = await import('./orama-store')
    return new OramaVectorStore()
  }
  if (kind === 'qdrant') {
    // qdrant 连接配置缺失即时序/配置错误，显式抛错不静默回落内存后端
    if (!config?.qdrant)
      throw new Error('qdrant vector store requires connection config (url + collection)')
    const { QdrantVectorStore } = await import('./qdrant-store')
    return new QdrantVectorStore(config.qdrant)
  }
  throw new Error(`invalid vector store: ${String(kind)} (expected ${VECTOR_STORE_KINDS.join(' | ')})`)
}
