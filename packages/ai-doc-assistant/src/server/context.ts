import type { EmbeddingModel, LanguageModel } from 'ai'
import type { ComponentContract } from '../core'
import type { RetrievalMode, RetrievalStrategy } from '../core/retrieval-strategy'
import type { QdrantConfig, VectorStoreConfig, VectorStoreKind } from '../core/vector-store'
import type { KnowledgeImportPayload, KnowledgeImportResult } from '../shared/protocol'
import type { AiDocProviderConfig, EmbeddingIdentitySeed } from './ai-provider'
/**
 * Server 运行时上下文：聚合 provider 配置、索引状态机、组件契约与检索策略。
 * 由 plugin/standalone 入口构造一次，注入各路由处理器，避免散落的全局态。
 *
 * 架构（ADR-0006 默认 + ADR-0007 可选增强）：检索经 RetrievalStrategy 抽象。
 * - content（默认）：抽取公共契约后做结构化关键词 topK 检索，零 embedding/向量库。
 * - vector（可选增强）：远程 embedding 建可插拔向量索引做语义检索。
 * 模式由 options.mode 或环境变量 AI_DOC_RETRIEVAL_MODE 决定，默认 content。
 * chat 与 embedding 分别使用用户显式配置的 Provider。
 */
import { join } from 'node:path'
import process from 'node:process'
import { createEmbeddingModel, createLanguageModel } from '@moluoxixi/ai-provider/server'
import { discoverComponentSources } from '../core/component-discovery'
import { extractContracts } from '../core/extractor'
import { IndexStateManager, sourceHashOf } from '../core/index-state'
import { contractKnowledgeKey, importExternalContract } from '../core/knowledge-source'
import { loadIndex, persistIndex, readMeta } from '../core/persist'
import { createStrategy, RETRIEVAL_MODES } from '../core/retrieval-strategy'
import { VECTOR_STORE_KINDS } from '../core/vector-store'
import { embeddingIdentitySeedOf, loadProviderConfig } from './ai-provider'

/** 上下文构造选项。 */
export interface ServerContextOptions {
  /** 组件库公共入口文件（相对 root 或绝对路径）。配置后只按入口扫描。 */
  componentEntries?: string[]
  /** legacy 显式 SFC glob（相对 root）。与 componentEntries 互斥。 */
  componentGlobs?: string[]
  /** 项目根目录。 */
  root: string
  /** 检索模式，默认读环境变量 AI_DOC_RETRIEVAL_MODE，再缺省为 content。 */
  mode?: RetrievalMode
  /** vector 模式向量存储后端，默认读 AI_DOC_VECTOR_STORE，再缺省为 orama；content 模式忽略。 */
  vectorStore?: VectorStoreKind
  /** 外部向量存储连接配置（如 qdrant）；options 优先于环境变量。 */
  vectorStoreConfig?: VectorStoreConfig
  /** 环境变量来源（测试可注入）。 */
  env?: NodeJS.ProcessEnv
  /** vector 快照目录；默认 `<root>/.ai-doc-index`。 */
  indexDir?: string
}

/** 环境变量名：检索模式开关。 */
export const RETRIEVAL_MODE_ENV = 'AI_DOC_RETRIEVAL_MODE'

/** 环境变量名：向量存储后端开关（仅 vector 模式生效）。 */
export const VECTOR_STORE_ENV = 'AI_DOC_VECTOR_STORE'

/** 环境变量名：Qdrant 连接 URL（vectorStore=qdrant 时必填）。 */
export const QDRANT_URL_ENV = 'AI_DOC_QDRANT_URL'

/** 环境变量名：Qdrant collection 名（vectorStore=qdrant 时必填）。 */
export const QDRANT_COLLECTION_ENV = 'AI_DOC_QDRANT_COLLECTION'

/** 环境变量名：Qdrant API Key（Qdrant Cloud 等鉴权场景，可选）。 */
export const QDRANT_API_KEY_ENV = 'AI_DOC_QDRANT_API_KEY'

/** 环境变量名：vector 快照目录。 */
export const INDEX_DIR_ENV = 'AI_DOC_INDEX_DIR'

/**
 * 解析检索模式。优先级：options.mode > 环境变量 > 默认 content。
 * 环境变量是系统边界输入：显式给出但非法时抛错，不静默回落默认（避免配置笔误被吞）。
 */
function resolveMode(opts: ServerContextOptions, env: NodeJS.ProcessEnv): RetrievalMode {
  if (opts.mode)
    return opts.mode
  const raw = env[RETRIEVAL_MODE_ENV]
  if (!raw)
    return 'content'
  if (!RETRIEVAL_MODES.includes(raw as RetrievalMode)) {
    throw new Error(
      `invalid ${RETRIEVAL_MODE_ENV}: ${raw} (expected ${RETRIEVAL_MODES.join(' | ')})`,
    )
  }
  return raw as RetrievalMode
}

/**
 * 解析向量存储后端。优先级：options.vectorStore > 环境变量 > 默认 orama。
 * 环境变量是系统边界输入：显式给出但非法时抛错，不静默回落默认（避免配置笔误被吞）。
 */
function resolveVectorStore(opts: ServerContextOptions, env: NodeJS.ProcessEnv): VectorStoreKind {
  if (opts.vectorStore)
    return opts.vectorStore
  const raw = env[VECTOR_STORE_ENV]
  if (!raw)
    return 'orama'
  if (!VECTOR_STORE_KINDS.includes(raw as VectorStoreKind)) {
    throw new Error(
      `invalid ${VECTOR_STORE_ENV}: ${raw} (expected ${VECTOR_STORE_KINDS.join(' | ')})`,
    )
  }
  return raw as VectorStoreKind
}

/**
 * 解析外部向量存储连接配置。优先级：options.vectorStoreConfig > 环境变量。
 * 仅当 vectorStore=qdrant 时校验 qdrant 连接串：url + collection 为系统边界必填项，
 * 缺失即显式抛错（不静默回落，避免连不上后端却伪装成功）。apiKey 可选。
 * @param opts ServerContext 构造选项，vectorStoreConfig 优先于环境变量。
 * @param env 进程环境变量，读取 AI_DOC_QDRANT_* 连接串。
 * @param store 已解析的后端标识；非 qdrant 时返回 undefined。
 */
function resolveVectorStoreConfig(
  opts: ServerContextOptions,
  env: NodeJS.ProcessEnv,
  store: VectorStoreKind,
): VectorStoreConfig | undefined {
  if (store !== 'qdrant')
    return undefined
  // options 优先：显式传入即采用（仍按 createVectorStore 边界校验）
  if (opts.vectorStoreConfig?.qdrant)
    return opts.vectorStoreConfig
  // 否则从环境变量装配：url + collection 为边界必填项
  const url = env[QDRANT_URL_ENV]
  const collection = env[QDRANT_COLLECTION_ENV]
  if (!url || !collection) {
    throw new Error(
      `qdrant vector store requires ${QDRANT_URL_ENV} + ${QDRANT_COLLECTION_ENV} `
      + `(or options.vectorStoreConfig.qdrant)`,
    )
  }
  const qdrant: QdrantConfig = { url, collection }
  const apiKey = env[QDRANT_API_KEY_ENV]
  if (apiKey)
    qdrant.apiKey = apiKey
  return { qdrant }
}

/**
 * Server 运行时上下文。
 */
export class ServerContext {
  readonly config: AiDocProviderConfig
  readonly languageModel: LanguageModel | null
  readonly state = new IndexStateManager()
  readonly mode: RetrievalMode
  /** vector 模式向量存储后端（content 模式不使用）。 */
  readonly vectorStore: VectorStoreKind
  /** 外部向量存储连接配置（仅 qdrant 后端使用，其余为 undefined）。 */
  private readonly vectorStoreConfig: VectorStoreConfig | undefined
  private readonly embeddingModel: EmbeddingModel | null
  private readonly embeddingIdentity: EmbeddingIdentitySeed | undefined
  private readonly indexDir: string
  private initializePromise: Promise<void> | null = null
  private contracts: ComponentContract[] = []
  private externalContracts: ComponentContract[] = []
  private strategy: RetrievalStrategy | null = null

  constructor(private readonly opts: ServerContextOptions) {
    const env = opts.env ?? process.env
    this.config = loadProviderConfig(env)
    this.languageModel = this.config.chat ? createLanguageModel(this.config.chat) : null
    this.embeddingModel = this.config.embedding ? createEmbeddingModel(this.config.embedding) : null
    this.embeddingIdentity = this.config.embedding
      ? embeddingIdentitySeedOf(this.config.embedding)
      : undefined
    this.mode = resolveMode(opts, env)
    this.vectorStore = this.mode === 'vector' ? resolveVectorStore(opts, env) : 'orama'
    this.vectorStoreConfig = this.mode === 'vector'
      ? resolveVectorStoreConfig(opts, env, this.vectorStore)
      : undefined
    this.indexDir = opts.indexDir ?? env[INDEX_DIR_ENV] ?? join(opts.root, '.ai-doc-index')
  }

  /** Restores a persisted vector index once before serving API requests. */
  initialize(): Promise<void> {
    if (this.initializePromise === null)
      this.initializePromise = this.restorePersistedIndex()
    return this.initializePromise
  }

  private async extractInternalContracts(): Promise<ComponentContract[]> {
    const files = await discoverComponentSources(this.opts)
    return (await extractContracts(files)).map(contract => ({
      ...contract,
      knowledgeSource: 'internal' as const,
      knowledgeKey: contractKnowledgeKey('internal', contract),
    }))
  }

  private async restorePersistedIndex(): Promise<void> {
    if (this.mode !== 'vector')
      return
    const meta = await readMeta(this.indexDir)
    if (!meta)
      return
    this.state.hydrate(meta, this.embeddingIdentity)
    if (!this.embeddingIdentity) {
      this.state.markStale()
      return
    }
    if (!this.state.isReady())
      return

    try {
      const contracts = await this.extractInternalContracts()
      if (sourceHashOf(contracts) !== meta.sourceHash) {
        this.state.markStale()
        return
      }
      const { snapshot } = await loadIndex(this.indexDir)
      const strategy = await createStrategy(this.mode, {
        embeddingIdentity: this.embeddingIdentity,
        embeddingModel: this.embeddingModel ?? undefined,
        vectorStore: this.vectorStore,
        vectorStoreConfig: this.vectorStoreConfig,
      })
      if (!strategy.hydrate)
        throw new Error('vector strategy does not support persisted index hydration')
      await strategy.hydrate(snapshot, meta)
      this.contracts = contracts
      this.strategy = strategy
    }
    catch {
      this.state.markStale()
    }
  }

  /**
   * 构建知识库：抽取公共契约 → 按 mode 建检索态（经状态机单飞）。
   * content 模式无需 Provider；vector 模式会把组件契约发送到远程 embedding Provider。
   */
  async buildIndex(): Promise<void> {
    await this.initialize()
    await this.state.runBuild(async () => {
      const contracts = await this.extractInternalContracts()
      // 初始化/重建只刷新内部知识库；用户导入的外部知识库保留并与内部合并检索。
      const allContracts = [...contracts, ...this.externalContracts]
      const { meta, strategy } = await this.buildStrategy(allContracts)
      this.contracts = contracts
      this.strategy = strategy
      return meta
    })
  }

  private async buildStrategy(contracts: ComponentContract[]) {
    const strategy = await createStrategy(this.mode, {
      embeddingIdentity: this.embeddingIdentity,
      embeddingModel: this.embeddingModel ?? undefined,
      vectorStore: this.vectorStore,
      vectorStoreConfig: this.vectorStoreConfig,
    })
    const strategyMeta = await strategy.build(contracts)
    const meta = {
      ...strategyMeta,
      sourceHash: sourceHashOf(contracts),
    }
    if (this.mode === 'vector') {
      if (!strategy.snapshot)
        throw new Error('vector strategy does not support persisted snapshots')
      await persistIndex(this.indexDir, { snapshot: strategy.snapshot(), meta })
    }
    return { meta, strategy }
  }

  /** 导入外部知识库。重复外部项需 overwrite；外部永不覆盖内部同名组件。 */
  async importKnowledge(payload: KnowledgeImportPayload, overwrite = false): Promise<KnowledgeImportResult> {
    await this.initialize()
    const imported = importExternalContract(payload, this.contracts, this.externalContracts, overwrite)
    if (imported.result.status === 'conflict')
      return imported.result
    const nextExternalContracts = imported.contracts
    await this.state.runBuild(async () => {
      const { meta, strategy } = await this.buildStrategy([...this.contracts, ...nextExternalContracts])
      this.externalContracts = nextExternalContracts
      this.strategy = strategy
      return meta
    })
    return imported.result
  }

  /** 当前检索策略（未构建时为 null，由上层映射 INDEX_NOT_READY）。 */
  getStrategy(): RetrievalStrategy | null {
    return this.strategy
  }

  /** 当前组件契约列表（供 GET /components）。 */
  getContracts(): ComponentContract[] {
    return this.contracts
  }

  /** 当前外部导入契约列表。 */
  getExternalContracts(): ComponentContract[] {
    return this.externalContracts
  }

  /** 内外合并契约列表；key 带 source，允许同名组件以内/外并存。 */
  getAllContracts(): Array<{ contract: ComponentContract, source: 'internal' | 'external', key: string }> {
    return [
      ...this.contracts.map(contract => ({ contract, source: 'internal' as const, key: contract.knowledgeKey ?? contractKnowledgeKey('internal', contract) })),
      ...this.externalContracts.map(contract => ({ contract, source: 'external' as const, key: contract.knowledgeKey ?? contractKnowledgeKey('external', contract) })),
    ]
  }
}
