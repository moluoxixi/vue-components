/**
 * @moluoxixi/ai-doc-assistant 主入口。
 *
 * 聚合公共 API（ADR-0006：小知识库全量契约喂 LLM，无向量索引/检索/持久化）：
 * - core：组件契约抽取、可检索文档/示例生成、抽取状态机、领域类型。
 * - server：运行时上下文、框架无关路由分发、AI provider 配置与客户端、查询编排。
 * - protocol：前后端共享的协议契约（请求/响应/SSE 事件/错误码/编解码）。
 */

// ── core：文档/示例生成 ─────────────────────────────────────────
export { renderExample, renderExampleSkeleton, renderSearchableDoc } from './src/core'

export { splitAnswerSegments } from './src/core'
// ── core：契约抽取 ──────────────────────────────────────────────
export { extractContract, extractContracts } from './src/core/extractor'

// ── core：抽取状态机 ────────────────────────────────────────────
export { IndexStateManager } from './src/core/index-state'
export type { IndexMeta, IndexStatus, IndexStatusSnapshot } from './src/core/index-state'

// ── core：领域类型 ──────────────────────────────────────────────
export type {
  ComponentContract,
  EmitDef,
  ModelDef,
  PropDef,
  SlotDef,
} from './src/core/types'

// ── server：AI 客户端（chat 流式）────────────────────────────────
export { streamChat } from './src/server/ai-client'
export type { ChatMessage } from './src/server/ai-client'

// ── server：AI provider 配置 ────────────────────────────────────
export { ENV_KEYS, loadProviderConfig, providerStatusOf } from './src/server/ai-provider'

export type { ProviderConfig, ProviderStatus } from './src/server/ai-provider'
// ── server：运行时上下文 ────────────────────────────────────────
export { ServerContext } from './src/server/context'

export type { ServerContextOptions } from './src/server/context'
// ── server：查询编排 ────────────────────────────────────────────
export { runQuery } from './src/server/query-handler'

export type { QueryDeps } from './src/server/query-handler'
// ── server：路由分发 ────────────────────────────────────────────
export { dispatch } from './src/server/router'

// ── protocol：前后端共享协议 ────────────────────────────────────
export * from './src/shared/protocol'
