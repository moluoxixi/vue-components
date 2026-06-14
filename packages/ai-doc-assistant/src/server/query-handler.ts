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
import type { ExampleBlock, SourceRef, SseEvent } from '../shared/protocol'
import type { ChatMessage, streamChat } from './ai-client'
import type { ProviderConfig } from './ai-provider'
import { extractVueBlocks, PREVIEW_ALLOWED_MODULES } from '../core/vue-block-extractor'

/** 编排依赖（注入便于测试 stub）。 */
export interface QueryDeps {
  /** 检索策略（由 ServerContext 启动时按 mode 构建并持有）。 */
  strategy: RetrievalStrategy
  config: ProviderConfig
  /** 流式 chat 函数（注入 streamChat 或 stub）。 */
  chat: typeof streamChat
}

/** 系统提示：约束模型只依据上下文回答，并产出预览环境可编译的完整示例。 */
const SYSTEM_PROMPT = `你是组件库文档助手。只依据提供的「组件契约上下文」回答用户问题。
规则：
1. 答案必须基于上下文中的真实组件信息，不得编造不存在的 Props/事件/插槽。
2. 若上下文为空或不足以回答，明确告知用户"未找到相关组件信息"，不要猜测。
3. 回答简洁，必要时引用具体 Prop 名称与类型。
4. 当给出使用示例时，必须输出**完整可运行**的 \`\`\`vue 代码块：包含 <script setup lang="ts">、必要的示例数据（如表格的 columns/data 用真实字段与样例行）、以及 <template>，让示例可直接渲染预览。
5. 示例代码**只能 import 这些依赖**：${PREVIEW_ALLOWED_MODULES.join('、')}。不要引入 element-plus、axios、lodash 等其它库，否则预览环境无法编译。
6. 若某个示例确实必须依赖上述白名单之外的库，请在该代码块的语言标记后加 \`no-demo\`（写成 \`\`\`vue no-demo），并在正文说明依赖了哪个库、为什么——该块将仅展示源码、不做预览渲染。`

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

  // 4. 构造上下文 + 流式问答（用命中契约的正文）。
  //    token 照常实时 yield 给前端正文；同时缓冲全文，待流结束后从中提取 vue 代码块转 demo。
  const context = chunks.map(c => c.body).join('\n\n')
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `组件契约上下文：\n${context}\n\n用户问题：${question}` },
  ]

  let answer = ''
  for await (const token of deps.chat(deps.config, messages)) {
    answer += token
    yield { type: 'token', text: token }
  }

  // 5. 从回答中提取全部 vue 代码块，逐块判定能否转 demo（依赖白名单 + no-demo 标识）。
  //    可渲染块由前端编译挂载；不可渲染块仅展示源码 + reason。
  //    回答未给任何 vue 块时，回退首个命中组件的确定性骨架（保证总有可用示例）。
  const top = chunks[0]
  const extracted = extractVueBlocks(answer)
  const blocks: ExampleBlock[] = extracted.length
    ? extracted.map(b => ({ ts: b.source, renderable: b.renderable, reason: b.reason }))
    : [{ ts: top.exampleCode.ts, js: top.exampleCode.js, renderable: true }]

  // 兼容字段 code/ts/js 指向首个可渲染块，无可渲染块时指向骨架（旧前端只读这些字段仍可用）。
  const firstRenderable = blocks.find(b => b.renderable)
  const compat = firstRenderable ?? { ts: top.exampleCode.ts, js: top.exampleCode.js }
  yield {
    type: 'example',
    code: compat.ts,
    lang: 'vue',
    ts: compat.ts,
    js: compat.js ?? top.exampleCode.js,
    component: top.component,
    packageName: top.packageName,
    blocks,
  }

  yield { type: 'done' }
}
