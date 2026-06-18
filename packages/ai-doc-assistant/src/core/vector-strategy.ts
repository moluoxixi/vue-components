import type {
  RetrievalStrategy,
  StrategyChunk,
  StrategyMeta,
  StrategyResult,
} from './retrieval-strategy'
import type { ComponentContract } from './types'
import type { VectorDoc, VectorStore, VectorStoreConfig, VectorStoreKind } from './vector-store'
/**
 * vector 检索策略（可选增强，ADR-0007）：本地 embedding + 可插拔向量存储。
 *
 * 本模块及其依赖（@huggingface/transformers、@orama/orama）只在 retrieval mode=vector
 * 时经动态 import 加载；默认 content 模式不引用本文件，故其重依赖不进默认 bundle。
 *
 * 流程：build 时把契约渲染为正文 → 本地模型编码为向量 → 交向量存储建索引；
 * retrieve 时把问题编码为查询向量 → 委托存储做向量语义 + BM25 混合召回 topK。
 *
 * 存储后端可插拔（VectorStore）：默认 orama 内存索引，大知识库可扩 Qdrant/pgvector 等。
 * 失败语义：embedding 数量/维度不符、查询编码为空时显式抛错，不静默放行错位向量。
 */
import { EMBEDDING_DIM, embedTexts } from './embedder'
import { renderExample, renderSearchableDoc } from './generator'
import { createVectorStore } from './vector-store'

/** 默认纳入上下文的组件数上限（vector 模式按相似度取 topK）。 */
const DEFAULT_TOP_K = 5

/**
 * 向量检索策略。持有构建后的向量存储，对外提供语义检索。
 * @param storeKind 向量存储后端，默认 orama；其余为外部存储扩展点。
 * @param storeConfig 外部存储连接配置（如 qdrant url/collection）；orama 忽略。
 */
export class VectorStrategy implements RetrievalStrategy {
  readonly mode = 'vector' as const
  private store: VectorStore | null = null
  private builtAt: string | null = null
  private componentCount = 0

  constructor(
    private readonly storeKind: VectorStoreKind = 'orama',
    private readonly storeConfig?: VectorStoreConfig,
  ) {}

  async build(contracts: ComponentContract[]): Promise<StrategyMeta> {
    // 全量抽取的契约 → 渲染正文/双码示例 → 本地 embedding → 交向量存储建索引。
    // 双码（TS/JS）随文档一并持久化，检索时原样复原，绝不在召回侧用 js=ts 劣化。
    const docs = contracts.map((c) => {
      const exampleCode = renderExample(c)
      return {
        component: c.name,
        packageName: c.packageName,
        docPath: c.sourceFile,
        source: c.knowledgeSource ?? 'internal',
        knowledgeKey: c.knowledgeKey ?? `${c.knowledgeSource ?? 'internal'}:${encodeURIComponent(c.packageName)}:${encodeURIComponent(c.name)}`,
        body: renderSearchableDoc(c),
        example: exampleCode.ts,
        exampleJs: exampleCode.js,
      }
    })

    const embeddings = await embedTexts(docs.map(d => d.body))
    // 数量一致性是向量与文档对位的前提：不符即显式抛错，不静默补齐/截断
    if (embeddings.length !== docs.length) {
      throw new Error(
        `embedding count mismatch: got ${embeddings.length}, expected ${docs.length}`,
      )
    }

    const vectorDocs: VectorDoc[] = docs.map((d, i) => {
      const vec = embeddings[i]
      // 维度一致性是检索正确性前提：不符即显式抛错，不放行错位向量
      if (vec.length !== EMBEDDING_DIM) {
        throw new Error(
          `embedding dim mismatch for ${d.component}: got ${vec.length}, expected ${EMBEDDING_DIM}`,
        )
      }
      return { ...d, embedding: vec }
    })

    this.store = await createVectorStore(this.storeKind, this.storeConfig)
    await this.store.build(vectorDocs)
    this.builtAt = new Date().toISOString()
    this.componentCount = vectorDocs.length
    return { builtAt: this.builtAt, componentCount: this.componentCount }
  }

  isReady(): boolean {
    return this.store !== null && this.store.isReady()
  }

  async retrieve(question: string, topK: number): Promise<StrategyResult> {
    // 未构建即检索属时序错误，显式抛错（不静默返回空伪装无命中）
    if (this.store === null)
      throw new Error('vector strategy not built: call build() before retrieve()')

    // 本地 embedding 编码问题为查询向量；编码为空即失败，显式抛错不带 undefined 进检索
    const [queryVector] = await embedTexts([question])
    if (!queryVector)
      throw new Error('failed to embed query: empty embedding result')

    const { chunks, empty } = await this.store.search(
      question,
      queryVector,
      topK || DEFAULT_TOP_K,
    )

    // RetrievedChunk → StrategyChunk（字段对齐统一接口）。
    // 双码从持久化的 example(ts)+exampleJs 复原，绝不用 js=ts 静默劣化。
    const mapped: StrategyChunk[] = chunks.map(c => ({
      component: c.component,
      packageName: c.packageName,
      docPath: c.docPath,
      source: c.source,
      knowledgeKey: c.knowledgeKey,
      body: c.body,
      example: c.example,
      exampleCode: { ts: c.example, js: c.exampleJs },
      score: c.score,
    }))
    return { chunks: mapped, empty }
  }
}
