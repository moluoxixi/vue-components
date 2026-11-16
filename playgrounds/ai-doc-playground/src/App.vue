<script setup lang="ts">
/**
 * AI 文档调试台主界面：左问答（SSE 流式）+ 右实时预览。
 * 顶部状态栏展示 provider 配置态与索引状态，提供「建索引」入口。
 */
import { onMounted, ref } from 'vue'
import {
  buildIndex,
  fetchComponents,
  fetchHealth,
  fetchStatus,
  streamQuery,
} from './api'
import type { ComponentListItem, SourceRef } from './api'
import PreviewPane from './PreviewPane.vue'

const question = ref('')
const answer = ref('')
const sources = ref<SourceRef[]>([])
const exampleCode = ref('')
const exampleLang = ref('vue')
const loading = ref(false)
const errorMsg = ref('')

const health = ref<{ chat: string } | null>(null)
const indexState = ref('unknown')
const componentCount = ref(0)
const components = ref<ComponentListItem[]>([])
const building = ref(false)

/** 刷新顶部状态（health + index + 组件清单）。 */
async function refreshStatus(): Promise<void> {
  const [h, s] = await Promise.all([fetchHealth(), fetchStatus()])
  health.value = h.providers
  indexState.value = s.state
  componentCount.value = s.componentCount
  if (s.state === 'ready')
    components.value = await fetchComponents()
}

/** 触发建索引（embedding 全量组件，耗时操作）。 */
async function onBuild(): Promise<void> {
  building.value = true
  errorMsg.value = ''
  try {
    const s = await buildIndex()
    indexState.value = s.state
    componentCount.value = s.componentCount
    if (s.state === 'ready')
      components.value = await fetchComponents()
  }
  catch (e) {
    errorMsg.value = `建索引失败：${e instanceof Error ? e.message : String(e)}`
  }
  finally {
    building.value = false
  }
}

/** 提交问题，消费 SSE 流。 */
async function onAsk(): Promise<void> {
  const q = question.value.trim()
  if (!q || loading.value)
    return
  loading.value = true
  answer.value = ''
  sources.value = []
  exampleCode.value = ''
  errorMsg.value = ''

  try {
    await streamQuery(q, (event) => {
      if (event.type === 'sources')
        sources.value = event.sources
      else if (event.type === 'token')
        answer.value += event.text
      else if (event.type === 'example') {
        exampleCode.value = event.code
        exampleLang.value = event.lang
      }
      else if (event.type === 'error')
        errorMsg.value = `${event.error}: ${event.message}`
    })
  }
  catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    loading.value = false
  }
}

/** 点击示例问题快捷填入。 */
function useExample(q: string): void {
  question.value = q
}

onMounted(() => {
  refreshStatus().catch((e) => {
    errorMsg.value = `状态加载失败：${e instanceof Error ? e.message : String(e)}`
  })
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <strong>组件 AI 文档与调试助手</strong>
        <span class="sub">AST 契约 · 本地知识库 · 自然语言问答 · 真实组件预览</span>
      </div>
      <div class="status">
        <span class="badge" :class="health?.chat === 'configured' ? 'ok' : 'bad'">
          chat: {{ health?.chat ?? '...' }}
        </span>
        <span class="badge" :class="indexState === 'ready' ? 'ok' : 'warn'">
          index: {{ indexState }}（{{ componentCount }}）
        </span>
        <button class="build-btn" :disabled="building" @click="onBuild">
          {{ building ? '建索引中…' : '建索引' }}
        </button>
      </div>
    </header>

    <main class="split">
      <section class="left">
        <div class="qa-input">
          <textarea
            v-model="question"
            placeholder="问点什么？例如：DateRangePicker 怎么用？有哪些 props？"
            rows="3"
            @keydown.enter.exact.prevent="onAsk"
          />
          <button class="ask-btn" :disabled="loading" @click="onAsk">
            {{ loading ? '思考中…' : '提问 (Enter)' }}
          </button>
        </div>

        <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

        <div v-if="sources.length" class="sources">
          <div class="sources-title">命中来源</div>
          <div v-for="s in sources" :key="s.docPath" class="source-item">
            <span class="comp">{{ s.component }}</span>
            <span class="pkg">{{ s.packageName }}</span>
            <span class="score">{{ s.score }}</span>
          </div>
        </div>

        <div v-if="answer" class="answer">{{ answer }}</div>

        <div v-if="!answer && !loading" class="hints">
          <div class="hints-title">试试这些：</div>
          <button
            v-for="c in components.slice(0, 5)"
            :key="c.name"
            class="hint"
            @click="useExample(`${c.name} 怎么用？有哪些 props？`)"
          >
            {{ c.name }} 怎么用？
          </button>
        </div>
      </section>

      <section class="right">
        <PreviewPane :code="exampleCode" :lang="exampleLang" />
      </section>
    </main>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; }
.app { display: flex; flex-direction: column; height: 100vh; font-family: system-ui, sans-serif; color: #1f2328; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-bottom: 1px solid #d0d7de; background: #fff;
}
.brand { display: flex; flex-direction: column; gap: 2px; }
.brand .sub { font-size: 12px; color: #8c959f; }
.status { display: flex; align-items: center; gap: 8px; }
.badge {
  font-size: 12px; padding: 3px 8px; border-radius: 999px;
  border: 1px solid #d0d7de; background: #f6f8fa; color: #57606a;
}
.badge.ok { background: #dafbe1; border-color: #2da44e; color: #1a7f37; }
.badge.bad { background: #ffebe9; border-color: #cf222e; color: #cf222e; }
.badge.warn { background: #fff8c5; border-color: #d4a72c; color: #7d4e00; }
.build-btn {
  font-size: 12px; padding: 5px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid #2da44e; background: #2da44e; color: #fff;
}
.build-btn:disabled { opacity: .6; cursor: default; }
.split { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
.left { display: flex; flex-direction: column; gap: 14px; padding: 18px; overflow-y: auto; border-right: 1px solid #d0d7de; }
.right { min-height: 0; background: #fafbfc; }
.qa-input { display: flex; flex-direction: column; gap: 8px; }
textarea { width: 100%; padding: 10px 12px; border: 1px solid #d0d7de; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit; }
.ask-btn { align-self: flex-end; padding: 7px 18px; border-radius: 8px; cursor: pointer; border: 1px solid #0969da; background: #0969da; color: #fff; font-size: 13px; }
.ask-btn:disabled { opacity: .6; cursor: default; }
.error { padding: 10px 12px; border-radius: 8px; background: #ffebe9; border: 1px solid #ff818266; color: #cf222e; font-size: 13px; white-space: pre-wrap; }
.sources { border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden; }
.sources-title { padding: 6px 12px; font-size: 12px; font-weight: 600; color: #57606a; background: #f6f8fa; border-bottom: 1px solid #d0d7de; }
.source-item { display: flex; align-items: center; gap: 10px; padding: 7px 12px; font-size: 13px; border-bottom: 1px solid #f0f1f3; }
.source-item:last-child { border-bottom: 0; }
.source-item .comp { font-weight: 600; }
.source-item .pkg { color: #8c959f; font-size: 12px; }
.source-item .score { margin-left: auto; color: #0969da; font-variant-numeric: tabular-nums; }
.answer { padding: 14px 16px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; font-size: 14px; line-height: 1.65; white-space: pre-wrap; }
.hints { display: flex; flex-direction: column; gap: 8px; }
.hints-title { font-size: 12px; color: #8c959f; }
.hint { align-self: flex-start; padding: 6px 12px; border-radius: 999px; border: 1px solid #d0d7de; background: #f6f8fa; color: #0969da; font-size: 13px; cursor: pointer; }
</style>
