import type { EmbeddingModel } from 'ai'
import type { EmbeddingIdentitySeed, IndexMeta } from './index-state'
import type {
  RetrievalStrategy,
  StrategyChunk,
  StrategyMeta,
  StrategyResult,
} from './retrieval-strategy'
import type { ComponentContract } from './types'
import type { VectorDoc, VectorStore, VectorStoreConfig, VectorStoreKind } from './vector-store'
import { embed, embedMany } from 'ai'
import { validateEmbeddingBatch, validateEmbeddingVector } from './embedding-validation'
import { renderExample, renderSearchableDoc } from './generator'
import { matchesEmbeddingIdentity, sourceHashOf } from './index-state'
import { createVectorStore } from './vector-store'

const DEFAULT_TOP_K = 5

/** Remote embedding strategy backed by an SDK-native model and a pluggable vector store. */
export class VectorStrategy implements RetrievalStrategy {
  readonly mode = 'vector' as const
  private store: VectorStore | null = null
  private dimension: number | null = null

  constructor(
    private readonly embeddingModel: EmbeddingModel,
    private readonly embeddingIdentity: EmbeddingIdentitySeed,
    private readonly storeKind: VectorStoreKind = 'orama',
    private readonly storeConfig?: VectorStoreConfig,
  ) {}

  async build(contracts: ComponentContract[], signal?: AbortSignal): Promise<StrategyMeta> {
    const docs = contracts.map((contract) => {
      const exampleCode = renderExample(contract)
      return {
        component: contract.name,
        packageName: contract.packageName,
        docPath: contract.sourceFile,
        source: contract.knowledgeSource ?? 'internal',
        knowledgeKey: contract.knowledgeKey ?? `${contract.knowledgeSource ?? 'internal'}:${encodeURIComponent(contract.packageName)}:${encodeURIComponent(contract.name)}`,
        body: renderSearchableDoc(contract),
        example: exampleCode.ts,
        exampleJs: exampleCode.js,
      }
    })

    const { embeddings } = await embedMany({
      model: this.embeddingModel,
      values: docs.map(doc => doc.body),
      abortSignal: signal,
    })
    const dimension = validateEmbeddingBatch(embeddings, docs.length)
    const vectorDocs: VectorDoc[] = docs.map((doc, index) => ({
      ...doc,
      embedding: embeddings[index],
    }))

    const embeddingIdentity = { ...this.embeddingIdentity, dimension }
    const store = await createVectorStore(this.storeKind, this.storeConfig)
    await store.build(vectorDocs, {
      sourceHash: sourceHashOf(contracts),
      embeddingIdentity,
    }, signal)
    this.store = store
    this.dimension = dimension

    return {
      builtAt: new Date().toISOString(),
      componentCount: vectorDocs.length,
      embeddingIdentity,
    }
  }

  snapshot(): unknown {
    if (this.store === null || this.dimension === null)
      throw new Error('vector strategy not built: cannot create snapshot')
    return this.store.snapshot()
  }

  async hydrate(snapshot: unknown, meta: IndexMeta, signal?: AbortSignal): Promise<void> {
    const identity = meta.embeddingIdentity
    if (!identity || !matchesEmbeddingIdentity(identity, this.embeddingIdentity))
      throw new Error('vector index embedding identity is stale; rebuild the index')
    const store = await createVectorStore(this.storeKind, this.storeConfig)
    await store.hydrate(snapshot, {
      sourceHash: meta.sourceHash,
      embeddingIdentity: identity,
    }, signal)
    this.store = store
    this.dimension = identity.dimension
  }

  isReady(): boolean {
    return this.store !== null && this.dimension !== null && this.store.isReady()
  }

  async retrieve(question: string, topK: number, signal?: AbortSignal): Promise<StrategyResult> {
    if (this.store === null || this.dimension === null)
      throw new Error('vector strategy not built: call build() before retrieve()')

    const { embedding } = await embed({
      model: this.embeddingModel,
      value: question,
      abortSignal: signal,
    })
    validateEmbeddingVector(embedding, this.dimension, 'query embedding')

    const { chunks, empty } = await this.store.search(
      question,
      embedding,
      topK || DEFAULT_TOP_K,
      signal,
    )

    const mapped: StrategyChunk[] = chunks.map(chunk => ({
      component: chunk.component,
      packageName: chunk.packageName,
      docPath: chunk.docPath,
      source: chunk.source,
      knowledgeKey: chunk.knowledgeKey,
      body: chunk.body,
      example: chunk.example,
      exampleCode: { ts: chunk.example, js: chunk.exampleJs },
      score: chunk.score,
    }))
    return { chunks: mapped, empty }
  }
}
