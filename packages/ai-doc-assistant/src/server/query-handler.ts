import type { LanguageModel, ToolSet } from 'ai'
import type { RetrievalStrategy, StrategyChunk } from '../core/retrieval'
import type { AiDocUIMessage, ExampleBlock, SourceRef } from '../shared/protocol'
import {
  convertToModelMessages,
  createUIMessageStream,
  streamText,
  toUIMessageStream,
} from 'ai'
import { extractVueBlocks, PREVIEW_ALLOWED_MODULES, transpileSfcToJs } from '../core/preview'

export interface QueryDeps {
  model: LanguageModel | null
}

type PreparedModelMessages = Awaited<ReturnType<typeof convertToModelMessages>>

export interface PreparedQuery {
  messages: AiDocUIMessage[]
  chunks: StrategyChunk[]
  sources: SourceRef[]
  modelMessages: PreparedModelMessages | null
}

const SYSTEM_PROMPT = `你是组件库文档助手。只依据提供的「组件契约上下文」回答用户问题。
规则：
1. 答案必须基于上下文中的真实组件信息，不得编造不存在的 Props/事件/插槽。
2. 若上下文为空或不足以回答，明确告知用户"未找到相关组件信息"，不要猜测。
3. 回答简洁，必要时引用具体 Prop 名称与类型。
4. 当给出使用示例时，必须输出**完整可运行**的 \`\`\`vue 代码块：包含 <script setup lang="ts">（含所有 import 与示例数据，如表格的 columns/data 用真实字段与样例行）、以及 <template>，让示例可直接渲染预览。
5. **示例数据与组件用法必须放在同一个 \`\`\`vue 块内**：禁止把 columns/data 等示例数据单独写成 \`\`\`ts 块、再另写一个只有 <template> 片段的 \`\`\`vue 块。模板里用到的每个变量都必须在同块的 <script setup> 中定义，否则预览无法编译。
6. 示例代码**只能 import 这些依赖**：${PREVIEW_ALLOWED_MODULES.join('、')}。不要引入列表外依赖。
7. 表格/选择类组件若演示动态插槽，必须同时给出对应列配置、完整 data、事件处理函数。
8. 不要额外添加会改变组件行为的可选 prop；依赖注册与样式引入由预览宿主负责。
9. 只有上下文明确说明会禁用、校验或拦截的 Prop，才可用于对应示例。
10. 必须依赖白名单外库的代码块标记为 \`\`\`vue no-demo，并在正文说明原因。`

const DEFAULT_TOP_K = 5
const RETRIEVAL_HISTORY_QUESTIONS = 2
const NO_MATCH_ANSWER = '未找到与该问题相关的组件信息。请换一种描述，或确认组件库中存在对应组件。'
const SCRIPT_OPEN_TAG_RE = /<script(?=[\s>])[^>]*>/gi
const SCRIPT_LANG_TS_RE = /(?:^|\s)lang\s*=\s*(['"])ts\1/i

function textOf(message: AiDocUIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

function hasTsScript(source: string): boolean {
  return Array.from(source.matchAll(SCRIPT_OPEN_TAG_RE)).some(match => SCRIPT_LANG_TS_RE.test(match[0]))
}

function jsForSfcBlock(source: string): string | undefined {
  return transpileSfcToJs(source) ?? (hasTsScript(source) ? undefined : source)
}

export function exampleBlocksFromAnswer(answer: string, top: StrategyChunk): ExampleBlock[] {
  const extracted = extractVueBlocks(answer)
  const fallbackBlock: ExampleBlock = {
    ts: top.exampleCode.ts,
    js: top.exampleCode.js,
    renderable: true,
  }
  const blocks = extracted.length
    ? extracted.map((block): ExampleBlock => {
        const js = jsForSfcBlock(block.source)
        if (block.renderable && hasTsScript(block.source) && !js) {
          return {
            ts: block.source,
            renderable: false,
            reason: '示例语法不可转译，已保留源码并追加组件契约生成的可运行兜底示例。',
          }
        }
        return {
          ts: block.source,
          js,
          renderable: block.renderable,
          reason: block.reason,
        }
      })
    : [fallbackBlock]

  if (extracted.length && !blocks.some(block => block.renderable))
    blocks.push(fallbackBlock)
  return blocks
}

function contextualMessages(messages: AiDocUIMessage[], context: string, question: string): AiDocUIMessage[] {
  return messages.map((message, index) => ({
    id: message.id,
    role: message.role,
    parts: index === messages.length - 1
      ? [{ type: 'text' as const, text: `组件契约上下文：\n${context}\n\n用户问题：${question}` }]
      : [{ type: 'text' as const, text: textOf(message) }],
  }))
}

/** Runs retrieval and message conversion before response headers are committed. */
export async function prepareQuery(
  messages: AiDocUIMessage[],
  topK: number,
  strategy: RetrievalStrategy,
  signal?: AbortSignal,
): Promise<PreparedQuery> {
  signal?.throwIfAborted()
  const question = textOf(messages.at(-1) as AiDocUIMessage).trim()
  const previousQuestions = messages
    .slice(0, -1)
    .filter(message => message.role === 'user')
    .slice(-RETRIEVAL_HISTORY_QUESTIONS)
    .map(textOf)
  const retrievalQuestion = [...previousQuestions, question].join('\n')
  const { chunks, empty } = await strategy.retrieve(
    retrievalQuestion,
    topK || DEFAULT_TOP_K,
    signal,
  )
  signal?.throwIfAborted()

  const sources: SourceRef[] = chunks.map(chunk => ({
    component: chunk.component,
    packageName: chunk.packageName,
    docPath: chunk.docPath,
    score: chunk.score,
    source: chunk.source,
    knowledgeKey: chunk.knowledgeKey,
  }))
  if (empty || chunks.length === 0)
    return { messages, chunks: [], sources, modelMessages: null }

  const context = chunks.map(chunk => chunk.body).join('\n\n')
  const modelMessages = await convertToModelMessages(
    contextualMessages(messages, context, question),
  )
  return { messages, chunks, sources, modelMessages }
}

/** Creates the standard AI SDK UI Message Stream after retrieval has succeeded. */
export function createQueryUIMessageStream(
  prepared: PreparedQuery,
  deps: QueryDeps,
  signal?: AbortSignal,
) {
  return createUIMessageStream<AiDocUIMessage>({
    originalMessages: prepared.messages,
    onError: (error) => {
      if (signal?.aborted)
        throw error
      return 'AI provider request failed'
    },
    execute: async ({ writer }) => {
      signal?.throwIfAborted()
      writer.write({ type: 'data-sources', data: prepared.sources })

      if (prepared.chunks.length === 0) {
        const id = 'no-match'
        writer.write({ type: 'start' })
        writer.write({ type: 'start-step' })
        writer.write({ type: 'text-start', id })
        writer.write({ type: 'text-delta', id, delta: NO_MATCH_ANSWER })
        writer.write({ type: 'text-end', id })
        writer.write({ type: 'finish-step' })
        writer.write({ type: 'finish', finishReason: 'stop' })
        return
      }

      if (!deps.model || !prepared.modelMessages)
        throw new Error('provider not configured')

      const result = streamText({
        model: deps.model,
        system: SYSTEM_PROMPT,
        messages: prepared.modelMessages,
        abortSignal: signal,
      })
      writer.merge(toUIMessageStream<ToolSet, AiDocUIMessage>({
        stream: result.stream,
        originalMessages: prepared.messages,
        sendFinish: false,
      }))

      const answer = await result.text
      signal?.throwIfAborted()
      writer.write({
        type: 'data-example',
        data: { blocks: exampleBlocksFromAnswer(answer, prepared.chunks[0]) },
      })
      writer.write({ type: 'finish', finishReason: await result.finishReason })
    },
  })
}
