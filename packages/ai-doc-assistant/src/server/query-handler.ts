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
import { transpileSfcToJs } from '../core/sfc-transpile'
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
4. 当给出使用示例时，必须输出**完整可运行**的 \`\`\`vue 代码块：包含 <script setup lang="ts">（含所有 import 与示例数据，如表格的 columns/data 用真实字段与样例行）、以及 <template>，让示例可直接渲染预览。
5. **示例数据与组件用法必须放在同一个 \`\`\`vue 块内**：禁止把 columns/data 等示例数据单独写成 \`\`\`ts 块、再另写一个只有 <template> 片段的 \`\`\`vue 块。模板里用到的每个变量都必须在同块的 <script setup> 中定义，否则预览无法编译。讲解类型/字段含义可用行内代码或 \`\`\`ts 片段，但**可运行示例本身必须自包含于单个完整 vue 块**。
6. 示例代码**只能 import 这些依赖**：${PREVIEW_ALLOWED_MODULES.join('、')}。不要引入 axios、lodash 等列表外依赖，否则预览环境无法编译。
7. 表格/选择类组件若演示动态插槽，必须同时给出对应列配置（如 \`slots: { default: 'price' }\`）、完整 data、事件处理函数；不要只输出一段 \`<template #price>\` 片段。
8. 除了为示例可运行所必需的 import、数据、事件、插槽映射外，不要额外添加会改变组件行为的可选 prop；依赖注册与样式引入由预览宿主统一负责，不写进 AI 示例。
9. 不要把"默认值"、"首次无值初始化"、"快捷项"、"展示格式"这类配置推断成校验、禁用或权限逻辑；只有上下文明确说明会禁用/校验/拦截的 Prop，才可用于对应示例。若用户要求的能力上下文没有支持，先说明不支持，再给最接近的已支持方案。
10. 若某个示例确实必须依赖上述白名单之外的库，请在该代码块的语言标记后加 \`no-demo\`（写成 \`\`\`vue no-demo），并在正文说明依赖了哪个库、为什么——该块将仅展示源码、不做预览渲染。`

/** 默认上下文纳入的组件数上限（content 模式忽略，全量纳入）。 */
const DEFAULT_TOP_K = 5
const SCRIPT_OPEN_TAG_RE = /<script(?=[\s>])[^>]*>/gi
const SCRIPT_LANG_TS_RE = /(?:^|\s)lang\s*=\s*(['"])ts\1/i

/** 判断 SFC 是否包含 lang="ts" 的 script 块。 */
function hasTsScript(source: string): boolean {
  return Array.from(source.matchAll(SCRIPT_OPEN_TAG_RE)).some(match => SCRIPT_LANG_TS_RE.test(match[0]))
}

/** 给回答里的 SFC 代码块生成 JS 版；已是 JS SFC 时直接复用源码，TS 转译失败则不伪造。 */
function jsForSfcBlock(source: string): string | undefined {
  return transpileSfcToJs(source) ?? (hasTsScript(source) ? undefined : source)
}

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
  // 所有 TS 源都确定性转译出 JS 版：即便 no-demo / 白名单外块不挂载，也要能查看/复制 JS。
  // 转不出（无 ts script）则 js 缺省，前端隐藏 JS 切换，不伪造降级。
  const fallbackBlock: ExampleBlock = { ts: top.exampleCode.ts, js: top.exampleCode.js, renderable: true }
  const blockWithJs = (b: ReturnType<typeof extractVueBlocks>[number]): ExampleBlock => {
    const js = jsForSfcBlock(b.source)
    if (b.renderable && hasTsScript(b.source) && !js) {
      return {
        ts: b.source,
        js,
        renderable: false,
        reason: '示例语法不可转译，已保留源码并追加组件契约生成的可运行兜底示例。',
      }
    }
    return {
      ts: b.source,
      js,
      renderable: b.renderable,
      reason: b.reason,
    }
  }
  const blocks: ExampleBlock[] = extracted.length
    ? extracted.map(blockWithJs)
    : [fallbackBlock]

  if (extracted.length && !blocks.some(b => b.renderable))
    blocks.push(fallbackBlock)

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
