import type { RetrievalMode, RetrievalStrategy } from '../core/retrieval-strategy'
import type { ComponentContract } from '../core/types'
import type { QdrantConfig, VectorStoreConfig, VectorStoreKind } from '../core/vector-store'
import type { ProviderConfig } from './ai-provider'
/**
 * Server 运行时上下文：聚合 provider 配置、索引状态机、组件契约与检索策略。
 * 由 plugin/standalone 入口构造一次，注入各路由处理器，避免散落的全局态。
 *
 * 架构（ADR-0006 默认 + ADR-0007 可选升级）：检索经 RetrievalStrategy 抽象。
 * - content（默认）：全量抽取契约持有内存，直接拼上下文喂 chat，零 embedding/向量库。
 * - vector（升级）：本地 embedding 建 Orama 内存索引做语义检索（重依赖动态加载）。
 * 模式由 options.mode 或环境变量 AI_DOC_RETRIEVAL_MODE 决定，默认 content。
 * chat 走用户配置的第三方 provider；vector 模式的 embedding 完全本地（零 key）。
 */
import { glob } from 'node:fs/promises'
import process from 'node:process'
import { extractContracts } from '../core/extractor'
import { IndexStateManager } from '../core/index-state'
import { createStrategy, RETRIEVAL_MODES } from '../core/retrieval-strategy'
import { VECTOR_STORE_KINDS } from '../core/vector-store'
import { loadProviderConfig } from './ai-provider'

/** 上下文构造选项。 */
export interface ServerContextOptions {
  /** 组件源码 glob（相对 root），默认匹配各包 src 下的 index.vue。 */
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
  readonly config: ProviderConfig | null
  readonly state = new IndexStateManager()
  readonly mode: RetrievalMode
  /** vector 模式向量存储后端（content 模式不使用）。 */
  readonly vectorStore: VectorStoreKind
  /** 外部向量存储连接配置（仅 qdrant 后端使用，其余为 undefined）。 */
  private readonly vectorStoreConfig: VectorStoreConfig | undefined
  private contracts: ComponentContract[] = []
  private strategy: RetrievalStrategy | null = null

  constructor(private readonly opts: ServerContextOptions) {
    const env = opts.env ?? process.env
    this.config = loadProviderConfig(env)
    this.mode = resolveMode(opts, env)
    this.vectorStore = resolveVectorStore(opts, env)
    this.vectorStoreConfig = resolveVectorStoreConfig(opts, env, this.vectorStore)
  }

  /** 解析组件源码文件列表。 */
  private async resolveFiles(): Promise<{ filePath: string, packageName: string }[]> {
    const patterns = this.opts.componentGlobs ?? ['packages/*/src/**/index.vue']
    const files: { filePath: string, packageName: string }[] = []
    for (const pattern of patterns) {
      for await (const entry of glob(pattern, { cwd: this.opts.root })) {
        // 只把「直接父目录为 src」的 index.vue 当作独立组件入口。
        // 组件库门面约定：对外组件入口固定为 `<Comp>/src/index.vue`，其直接父目录是 src；
        // 而内部子组件（如 `<Comp>/src/base/index.vue`）的直接父目录是 base 等非 src 名，
        // 属于实现细节，其契约由父组件通过 $attrs 转发并在抽取时合并，不应作为幽灵组件单列。
        const segs = entry.split(/[/\\]/)
        if (segs[segs.length - 2] !== 'src')
          continue
        const pkg = segs[1] ?? 'unknown'
        files.push({ filePath: `${this.opts.root}/${entry}`, packageName: `@moluoxixi/${pkg}` })
      }
    }
    return files
  }

  /**
   * 构建知识库：抽取契约 → 按 mode 建检索态（经状态机单飞）。
   * content 模式无需任何 provider key；vector 模式 embedding 走本地模型，亦无需 key。
   */
  async buildIndex(): Promise<void> {
    await this.state.runBuild(async () => {
      const files = await this.resolveFiles()
      this.contracts = await extractContracts(files)
      // 按模式创建策略（vector 经动态 import，重依赖不进默认 bundle）
      const strategy = await createStrategy(this.mode, this.vectorStore, this.vectorStoreConfig)
      const meta = await strategy.build(this.contracts)
      this.strategy = strategy
      return {
        builtAt: meta.builtAt,
        componentCount: meta.componentCount,
        sourceHash: '',
      }
    })
  }

  /** 当前检索策略（未构建时为 null，由上层映射 INDEX_NOT_READY）。 */
  getStrategy(): RetrievalStrategy | null {
    return this.strategy
  }

  /** 当前组件契约列表（供 GET /components）。 */
  getContracts(): ComponentContract[] {
    return this.contracts
  }
}
