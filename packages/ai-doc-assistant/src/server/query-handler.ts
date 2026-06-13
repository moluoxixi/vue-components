/**
 * Query 编排器：把「检索策略命中的组件契约」+ ai-client 串成 SSE 事件流。
 *
 * 架构（ADR-0006 默认 + ADR-0007 可选）：检索经 RetrievalStrategy 抽象，
 * 默认 content（全量契约喂模型），可切 vector（本地 embedding 语义检索）。
 * 编排器只依赖策略接口，不感知具体检索方式。
 *
 * 事件序列：sources → token* → example? → done；任意阶段异常 → error。
 */
import type { RetrievalStrategy } from '../core/retrieval-strategy'
import type { SourceRef, SseEvent } from '../shared/protocol'
import type { ChatMessage, streamChat } from './ai-client'
import type { ProviderConfig } from './ai-provider'

/** 编排依赖（注入便于测试 stub）。 */
export interface QueryDeps {
  /** 检索策略（由 ServerContext 启动时按 mode 构建并持有）。 */
  strategy: RetrievalStrategy
  config: ProviderConfig
  /** 流式 chat 函数（注入 streamChat 或 stub）。 */
  chat: typeof streamChat
}

/** 系统提示：约束模型只依据提供的上下文回答，无依据时明确告知不编造。 */
const SYSTEM_PROMPT = `你是组件库文档助手。只依据提供的「组件契约上下文」回答用户问题。
规则：
1. 答案必须基于上下文中的真实组件信息，不得编造不存在的 Props/事件/插槽。
2. 若上下文为空或不足以回答，明确告知用户"未找到相关组件信息"，不要猜测。
3. 回答简洁，必要时引用具体 Prop 名称与类型。`

/** 默认上下文纳入的组件数上限（content 模式忽略，全量纳入）。 */
const DEFAULT_TOP_K = 5

/**
 * 执行一次 query，产出 SSE 事件序列。
 * @param question 用户问题。
 * @param topK 检索命中纳入上下文的组件数（默认 DEFAULT_TOP_K；content 模式全量纳入）。
 * @param deps 注入依赖。
 */
export async function* runQuery(
  question: string,
  topK: number,
  deps: QueryDeps,
): AsyncGenerator<SseEvent> {
  // 1. 经策略检索相关契约（content=全量；vector=语义召回）
  const { chunks, empty } = await deps.strategy.retrieve(question, topK || DEFAULT_TOP_K)

  // 2. 推送来源（可追溯）
  const sources: SourceRef[] = chunks.map(c => ({
    component: c.component,
    packageName: c.packageName,
    docPath: c.docPath,
    score: c.score,
  }))
  yield { type: 'sources', sources }

  // 3. 无依据兜底：无可用上下文时不调用模型编造，直接明确告知
  if (empty) {
    yield { type: 'token', text: '未找到与该问题相关的组件信息。请换一种描述，或确认组件库中存在对应组件。' }
    yield { type: 'done' }
    return
  }

  // 4. 构造上下文 + 流式问答（用命中契约的正文）
  const context = chunks.map(c => c.body).join('\n\n')
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `组件契约上下文：\n${context}\n\n用户问题：${question}` },
  ]

  for await (const token of deps.chat(deps.config, messages))
    yield { type: 'token', text: token }

  // 5. emit 首个命中组件的示例骨架（props 名称/类型与契约一致）
  yield { type: 'example', code: chunks[0].example, lang: 'vue' }

  yield { type: 'done' }
}
