<script setup lang="ts">
/**
 * AI Chat 视图：流式问答。
 * 消费 BFF 的 /query SSE 流：sources → token* → example? → done，分区实时渲染。
 * 支持父级通过 v-model:question 预填问题（如从详情页「问 AI」带入组件名）。
 * 仅在索引就绪时可提问；网络/HTTP 错误显式展示，不静默吞掉。
 */
import { computed, ref, watch } from 'vue'
import type { SourceRef } from '../../shared/protocol'
import { streamQuery } from '../api'

const props = defineProps<{ question: string, indexReady: boolean }>()
const emit = defineEmits<{ (e: 'update:question', v: string): void }>()

/** 本地提问输入（与父级 v-model 同步）。 */
const local = ref(props.question)
watch(() => props.question, v => (local.value = v))
watch(local, v => emit('update:question', v))

/** 流式回答文本累积。 */
const answer = ref('')
/** 检索命中来源。 */
const sources = ref<SourceRef[]>([])
/** 示例代码（example 事件）。 */
const example = ref<{ code: string, lang: string } | null>(null)
/** 错误信息。 */
const errorMsg = ref('')
/** 流式进行中标志。 */
const streaming = ref(false)

/** 是否可提问：有内容、非流式、索引就绪。 */
const canAsk = computed(() =>
  local.value.trim().length > 0 && !streaming.value && props.indexReady,
)

/** 发起流式提问，分区渲染 SSE 事件。 */
async function onAsk(): Promise<void> {
  if (!canAsk.value)
    return
  streaming.value = true
  answer.value = ''
  sources.value = []
  example.value = null
  errorMsg.value = ''
  try {
    await streamQuery(local.value.trim(), 5, (event) => {
      switch (event.type) {
        case 'sources':
          sources.value = event.sources
          break
        case 'token':
          answer.value += event.text
          break
        case 'example':
          example.value = { code: event.code, lang: event.lang }
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
        v-model="local"
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
      <p class="answer-text">
        {{ answer || '（等待提问）' }}
      </p>
    </section>

    <section v-if="example" class="example" data-testid="example">
      <h3>示例 ({{ example.lang }})</h3>
      <pre><code>{{ example.code }}</code></pre>
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
.answer-text { white-space: pre-wrap; line-height: 1.6; margin: 0; }
.example pre {
  background: #0d1117; color: #c9d1d9; padding: 14px;
  border-radius: 8px; overflow-x: auto; margin: 0;
}
.sources ul { list-style: none; padding: 0; margin: 0; }
.sources li { padding: 4px 0; font-size: 13px; }
.sources small { color: #57606a; }
</style>
