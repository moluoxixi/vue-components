<script setup lang="ts">
/**
 * AI Chat 视图：流式问答。
 * 消费 BFF 的 /query SSE 流：sources → token* → example? → done。
 *
 * 渲染策略（对齐用户诉求）：回答正文按「文字段 + vue 代码块」原位分段渲染——
 * 可渲染的 vue 块原地替换成 DemoPreview 实时预览 + 双码查看/复制；
 * 不可渲染的 vue 块（依赖预览环境外的库）原位展示源码 + 原因，不挂载；
 * 文字段照常以 Markdown 风格纯文本展示。分段由 splitAnswerSegments 实时计算，
 * 流式 token 累积过程中未闭合的代码块按文字处理，闭合后自动转为 demo 块。
 *
 * 仅在索引就绪时可提问；网络/HTTP 错误显式展示，不静默吞掉。
 */
import { computed, ref, useTemplateRef } from 'vue'
import type { ExampleBlock, IndexState, SourceRef } from '../../shared/protocol'
import { splitAnswerSegments } from '../../core'
import { streamQuery } from '../api'
import { DemoPreview } from '../components'

/** 提问输入：父级通过 v-model:question 双向绑定（预填组件名等）。 */
const question = defineModel<string>('question', { required: true })
const props = defineProps<{ indexReady: boolean, indexState: IndexState }>()
const questionInput = useTemplateRef<HTMLInputElement>('questionInput')

function focusQuestion(): void {
  questionInput.value?.focus()
}

defineExpose({ focusQuestion })

/** 流式回答文本累积。 */
const answer = ref('')

/**
 * 后端 example 事件携带的全部代码块（含 ts + 确定性转译的 js）。
 * 正文分段（segments）只切出 ts 源，js 来自后端——按 ts 源文本精确匹配回填，
 * 避免前端再引入 typescript 做转译。
 */
const exampleBlocks = ref<ExampleBlock[]>([])

/** 按归一化后的 ts 源文本查后端转译的 js 版（找不到返回 undefined，前端据此隐藏 JS 切换）。 */
function normalizeSource(source: string): string {
  return source.trim()
}
function blockForSource(source: string): ExampleBlock | undefined {
  const normalized = normalizeSource(source)
  return exampleBlocks.value.find(b => normalizeSource(b.ts) === normalized)
}
function jsForSource(source: string): string | undefined {
  return blockForSource(source)?.js
}
function renderableForSource(source: string, fallback: boolean): boolean {
  return blockForSource(source)?.renderable ?? fallback
}
function reasonForSource(source: string, fallback?: string): string | undefined {
  return blockForSource(source)?.reason ?? fallback
}
/** 检索命中来源。 */
const sources = ref<SourceRef[]>([])
/** 错误信息。 */
const errorMsg = ref('')
/** 流式进行中标志。 */
const streaming = ref(false)

/** 是否可提问：有内容、非流式、索引就绪。 */
const canAsk = computed(() =>
  question.value.trim().length > 0 && !streaming.value && props.indexReady,
)

const indexHint = computed(() => {
  if (props.indexState === 'building')
    return '知识库正在准备，完成后即可提问。'
  return '知识库尚未就绪，请先构建知识库。'
})

/** 把回答正文实时切分为有序分段（文字段 + vue 代码块），供模板原位渲染。 */
const segments = computed(() => splitAnswerSegments(answer.value))
/** 正文里已经原位渲染过的 vue 代码块源码，用于避免 example 事件 blocks 重复展示。 */
const inlineVueSources = computed(() => new Set(
  segments.value
    .filter(seg => seg.kind === 'vue')
    .map(seg => seg.source),
))
/**
 * 后端保障链路：若上游回答没有输出 ```vue 块，query-handler 会用契约生成兜底示例。
 * 这些 blocks 不在正文 segments 中，必须追加渲染为 demo 块，否则“保证总有可用示例”会在 UI 丢失。
 */
const fallbackExampleBlocks = computed(() => {
  const inline = Array.from(inlineVueSources.value).map(normalizeSource)
  return exampleBlocks.value.filter(block => !inline.includes(normalizeSource(block.ts)))
})

/** 发起流式提问，分区渲染 SSE 事件。 */
async function onAsk(): Promise<void> {
  if (!canAsk.value)
    return
  streaming.value = true
  answer.value = ''
  sources.value = []

  exampleBlocks.value = []
  errorMsg.value = ''
  try {
    await streamQuery(question.value.trim(), 5, (event) => {
      switch (event.type) {
        case 'sources':
          sources.value = event.sources
          break
        case 'token':
          answer.value += event.text
          break
        case 'example':
          // 捕获后端转译好的双码块，供正文分段按 ts 源回填 js。
          exampleBlocks.value = event.blocks
          break
        case 'error':
          errorMsg.value = `${event.error}: ${event.message}`
          break
        case 'done':
          break
      }
    })
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    streaming.value = false
  }
}
</script>

<template>
  <div class="chat" data-testid="chat-view">
    <div class="chat-body">
      <div v-if="errorMsg" class="hint error" data-testid="chat-error">
        {{ errorMsg }}
      </div>

      <section v-if="sources.length" class="sources" data-testid="sources">
        <h3>检索来源</h3>
        <ul>
          <li v-for="s in sources" :key="s.component">
            {{ s.component }} <small>{{ s.packageName }} · {{ s.score.toFixed(3) }}</small>
          </li>
        </ul>
      </section>

      <section class="answer" data-testid="answer">
        <h3>回答</h3>
        <template v-if="segments.length || fallbackExampleBlocks.length">
          <!-- 正文分段：文字段原样展示，vue 代码块原位替换为 demo 预览块 -->
          <template v-for="(seg, i) in segments" :key="i">
            <p v-if="seg.kind === 'text'" class="answer-text" data-testid="answer-text">
              {{ seg.text }}
            </p>
            <DemoPreview
              v-else
              :ts="seg.source"
              :js="jsForSource(seg.source)"
              :renderable="renderableForSource(seg.source, seg.renderable)"
              :reason="reasonForSource(seg.source, seg.reason)"
            />
          </template>
          <DemoPreview
            v-for="(block, i) in fallbackExampleBlocks"
            :key="`fallback-${i}`"
            :ts="block.ts"
            :js="block.js"
            :renderable="block.renderable"
            :reason="block.reason"
          />
        </template>
        <p v-else class="answer-text placeholder">
          （等待提问）
        </p>
      </section>
    </div>

    <form class="ask-panel" data-testid="ask-panel" @submit.prevent="onAsk">
      <div v-if="!indexReady" class="hint" data-testid="chat-need-index">
        {{ indexHint }}
      </div>
      <div class="ask-row">
        <input
          ref="questionInput"
          v-model="question"
          data-testid="question-input"
          placeholder="问点什么，比如：ElButton 怎么用？"
        >
        <button
          class="btn primary"
          data-testid="ask-btn"
          :disabled="!canAsk"
          @keydown.ctrl.enter.prevent="onAsk"
        >
          {{ streaming ? '回答中…' : '提问' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chat {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 20px 8px;
}
.ask-panel {
  flex: 0 0 auto;
  padding: 12px 20px 16px;
  border-top: 1px solid #d0d7de;
  background: #fff;
}
.ask-row { display: flex; gap: 8px; }
.ask-row input {
  flex: 1; padding: 10px 12px; border: 1px solid #d0d7de;
  border-radius: 6px; font-size: 14px;
}
.btn {
  padding: 8px 14px; border: 1px solid #d0d7de; border-radius: 6px;
  background: #f6f8fa; cursor: pointer; font-size: 13px;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.primary { background: #238636; color: #fff; border-color: #238636; }
.hint { color: #57606a; font-size: 13px; margin-bottom: 12px; }
.hint.error { color: #cf222e; }
section { margin-bottom: 16px; }
section h3 { font-size: 13px; color: #57606a; margin: 0 0 8px; }
.answer-text { white-space: pre-wrap; line-height: 1.6; margin: 0 0 12px; }
.answer-text.placeholder { color: #8b949e; }
.sources ul { list-style: none; padding: 0; margin: 0; }
.sources li { padding: 4px 0; font-size: 13px; }
.sources small { color: #57606a; }
</style>
