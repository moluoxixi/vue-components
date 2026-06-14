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
import { computed, ref } from 'vue'
import type { SourceRef } from '../../shared/protocol'
import { splitAnswerSegments } from '../../core/vue-block-extractor'
import { streamQuery } from '../api'
import { DemoPreview } from '../components'

/** 提问输入：父级通过 v-model:question 双向绑定（预填组件名等）。 */
const question = defineModel<string>('question', { required: true })
const props = defineProps<{ indexReady: boolean }>()

/** 流式回答文本累积。 */
const answer = ref('')
/** 命中组件标识：example 事件携带，供 demo 块编译挂载真实组件时解析本地组件库。 */
const exampleComponent = ref('')
const examplePackage = ref('')
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

/** 把回答正文实时切分为有序分段（文字段 + vue 代码块），供模板原位渲染。 */
const segments = computed(() => splitAnswerSegments(answer.value))

/** 发起流式提问，分区渲染 SSE 事件。 */
async function onAsk(): Promise<void> {
  if (!canAsk.value)
    return
  streaming.value = true
  answer.value = ''
  sources.value = []
  exampleComponent.value = ''
  examplePackage.value = ''
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
          // 组件标识用于 demo 块编译挂载真实组件；代码块本身从正文 segments 解析，不再单独挂载。
          exampleComponent.value = event.component
          examplePackage.value = event.packageName
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
    <div class="ask-row">
      <input
        v-model="question"
        data-testid="question-input"
        placeholder="问点什么，比如：ElButton 怎么用？"
        @keyup.enter="onAsk"
      >
      <button
        class="btn primary"
        data-testid="ask-btn"
        :disabled="!canAsk"
        @click="onAsk"
      >
        {{ streaming ? '回答中…' : '提问' }}
      </button>
    </div>

    <div v-if="!indexReady" class="hint" data-testid="chat-need-index">
      索引尚未构建，请先在顶部点击「构建索引」。
    </div>
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
      <template v-if="segments.length">
        <!-- 正文分段：文字段原样展示，vue 代码块原位替换为 demo 预览块 -->
        <template v-for="(seg, i) in segments" :key="i">
          <p v-if="seg.kind === 'text'" class="answer-text" data-testid="answer-text">
            {{ seg.text }}
          </p>
          <DemoPreview
            v-else
            data-testid="answer-demo"
            :ts="seg.source"
            :component="exampleComponent"
            :package-name="examplePackage"
            :renderable="seg.renderable"
            :reason="seg.reason"
          />
        </template>
      </template>
      <p v-else class="answer-text placeholder">
        （等待提问）
      </p>
    </section>
  </div>
</template>

<style scoped>
.chat { padding: 20px; }
.ask-row { display: flex; gap: 8px; margin-bottom: 16px; }
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
