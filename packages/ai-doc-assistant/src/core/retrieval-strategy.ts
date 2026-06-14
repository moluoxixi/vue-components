import type { ExampleCode } from './generator'
import type { ComponentContract } from './types'
import type { VectorStoreConfig, VectorStoreKind } from './vector-store'
/**
 * 检索策略抽象层：把「问题 → 命中的组件契约」这一步抽象为可替换策略。
 *
 * 架构（ADR-0006 默认 + ADR-0007 可选升级）：
 * - content（默认）：小知识库全量契约直接拼进上下文，零 embedding / 零向量库，
 *   依赖最轻、结果最稳，组件库几十~几百项规模下最准最省。
 * - vector（升级）：组件数增长后，启用「本地 embedding + Orama 混合检索」做语义召回。
 *   其重依赖（@huggingface/transformers、@orama/orama）经动态 import 按需加载，
 *   默认 content 模式的产物 bundle 完全不含这些重依赖。
 *
 * 切换入口：环境变量 AI_DOC_RETRIEVAL_MODE 或 plugin/Context options.mode，默认 content。
 */
import { renderExample, renderSearchableDoc } from './generator'

/** 检索模式。content=全量上下文（默认）；vector=向量语义检索（升级）。 */
export type RetrievalMode = 'content' | 'vector'

/** 合法模式集合，用于边界校验。 */
export const RETRIEVAL_MODES: readonly RetrievalMode[] = ['content', 'vector']

/** 单条命中：组件契约正文 + 预生成示例 + 相关度分。 */
export interface StrategyChunk {
  component: string
  packageName: string
  docPath: string
  /** 契约正文（自然语言化），作为喂给 chat 的上下文。 */
  body: string
  /** 带类型提示的使用示例骨架（TS，向后兼容字段，等于 exampleCode.ts）。 */
  example: string
  /** 双语言示例源码（TS/JS），供 demo 预览块切换查看/复制与运行时编译挂载。 */
  exampleCode: ExampleCode
  /** 相关度分（content 模式恒为 1；vector 模式为检索相似度）。 */
  score: number
}

/** 检索结果。empty=true 表示无可用上下文，上层据此走「无依据兜底」。 */
export interface StrategyResult {
  chunks: StrategyChunk[]
  empty: boolean
}

/** 构建产物元信息。 */
export interface StrategyMeta {
  builtAt: string
  componentCount: number
}

/**
 * 检索策略接口。ServerContext 启动时选定一种实现，build 后对外提供 retrieve。
 */
export interface RetrievalStrategy {
  /** 当前模式标识。 */
  readonly mode: RetrievalMode
  /**
   * 用组件契约构建检索态。
   * content：直接持有契约；vector：本地 embedding 建 Orama 索引。
   * @returns 构建元信息（组件数、构建时间）。
   */
  build: (contracts: ComponentContract[]) => Promise<StrategyMeta>
  /** 是否已构建就绪（未就绪时上层映射 INDEX_NOT_READY）。 */
  isReady: () => boolean
  /**
   * 检索与问题相关的组件契约。
   * @param question 用户问题。
   * @param topK 纳入上下文的组件数上限（content 模式全量纳入，忽略该值）。
   */
  retrieve: (question: string, topK: number) => Promise<StrategyResult>
}

/**
 * content 策略（默认）：把全部组件契约渲染为上下文，整体喂给 chat 模型。
 * 无检索、无 embedding、无外部重依赖——小知识库下最稳最省。
 */
export class ContentStrategy implements RetrievalStrategy {
  readonly mode = 'content' as const
  private chunks: StrategyChunk[] | null = null
  private builtAt: string | null = null

  async build(contracts: ComponentContract[]): Promise<StrategyMeta> {
    // content 模式无异步重活，但保持 async 契约一致，便于与 vector 策略统一调用
    this.chunks = contracts.map((c) => {
      const exampleCode = renderExample(c)
      return {
        component: c.name,
        packageName: c.packageName,
        docPath: c.sourceFile,
        body: renderSearchableDoc(c),
        example: exampleCode.ts,
        exampleCode,
        score: 1,
      }
    })
    this.builtAt = new Date().toISOString()
    return { builtAt: this.builtAt, componentCount: this.chunks.length }
  }

  isReady(): boolean {
    return this.chunks !== null
  }

  async retrieve(_question: string, _topK: number): Promise<StrategyResult> {
    // 未构建即检索属调用方时序错误，显式抛错（不静默返回空伪装无命中）
    if (this.chunks === null)
      throw new Error('content strategy not built: call build() before retrieve()')

    // 全量纳入：组件库规模小，整体契约即上下文；无组件时判定 empty 触发兜底
    return { chunks: this.chunks, empty: this.chunks.length === 0 }
  }
}

/**
 * 按模式创建策略。vector 经动态 import 加载，使其重依赖不进默认（content）bundle。
 * mode 为系统边界输入，非法值显式抛错（不静默回落默认，避免配置笔误被吞掉）。
 * @param mode 检索模式。
 * @param vectorStore vector 模式下的向量存储后端，默认 orama；content 模式忽略。
 * @param vectorStoreConfig 外部存储连接配置（如 qdrant url/collection）；orama/content 忽略。
 */
export async function createStrategy(
  mode: RetrievalMode,
  vectorStore: VectorStoreKind = 'orama',
  vectorStoreConfig?: VectorStoreConfig,
): Promise<RetrievalStrategy> {
  if (mode === 'content')
    return new ContentStrategy()
  if (mode === 'vector') {
    const { VectorStrategy } = await import('./vector-strategy')
    return new VectorStrategy(vectorStore, vectorStoreConfig)
  }
  throw new Error(`invalid retrieval mode: ${String(mode)} (expected 'content' | 'vector')`)
}
