<script setup lang="ts">
/**
 * AI 文档助手可视化面板（外壳）。
 *
 * 固定头部：标题 + /health 状态徽章（模式 / chat 配置态，不含密钥）+ 索引状态 +
 * 构建索引按钮 + 知识库调试入口。主区域默认且始终展示 Chat；组件总览/详情放进
 * 调试弹框，避免把“知识库维护界面”压在用户问答主流程前面。
 */
import { onMounted, ref } from 'vue'
import type { ComponentListItem, HealthResponse } from '../shared/protocol'
import { buildIndex, fetchComponents, fetchHealth, fetchStatus } from './api'
import ChatView from './views/ChatView.vue'
import DetailView from './views/DetailView.vue'
import OverviewView from './views/OverviewView.vue'

/** 调试弹框内的知识库视图。 */
type DebugView = 'overview' | 'detail'
const debugView = ref<DebugView>('overview')
/** 是否打开知识库调试弹框。 */
const showKnowledgeDialog = ref(false)
/** 详情视图当前组件名。 */
const activeComponent = ref('')
/** Chat 视图预填问题（详情页「问 AI」带入）。 */
const question = ref('')

/** provider/模式/索引健康信息。 */
const health = ref<HealthResponse | null>(null)
/** 组件清单。 */
const components = ref<ComponentListItem[]>([])
/** 索引状态文案。 */
const indexState = ref<string>('unknown')
const componentCount = ref(0)
/** 错误信息（非空即展示红条）。 */
const errorMsg = ref('')
/** 索引构建中标志。 */
const building = ref(false)

/** 拉取健康态与索引状态。 */
async function refreshHealth(): Promise<void> {
  health.value = await fetchHealth()
  const status = await fetchStatus()
  indexState.value = status.state
  componentCount.value = status.componentCount
}

/** 触发索引构建，完成后刷新状态与组件清单。 */
async function onBuild(): Promise<void> {
  building.value = true
  errorMsg.value = ''
  try {
    const status = await buildIndex()
    indexState.value = status.state
    componentCount.value = status.componentCount
    components.value = await fetchComponents()
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    building.value = false
  }
}

/** 从总览打开某组件详情。 */
function openDetail(name: string): void {
  activeComponent.value = name
  debugView.value = 'detail'
  showKnowledgeDialog.value = true
}

/** 从详情跳到 Chat 并预填该组件的问题。 */
function askAbout(name: string): void {
  question.value = `${name} 怎么用？给个示例`
  showKnowledgeDialog.value = false
}

/** 打开知识库调试弹框，用于检查当前索引里有哪些组件契约。 */
function openKnowledgeDebug(): void {
  debugView.value = 'overview'
  showKnowledgeDialog.value = true
}

onMounted(async () => {
  try {
    await refreshHealth()
    components.value = await fetchComponents()
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <div class="ai-doc-app">
    <header class="topbar">
      <h1 data-testid="app-title">
        AI 文档助手
      </h1>
      <div class="status-chips">
        <span class="chip" :class="`mode-${health?.mode}`" data-testid="mode-chip">
          模式: {{ health?.mode ?? '...' }}
        </span>
        <span class="chip" data-testid="chat-chip">
          Chat: {{ health?.providers.chat ?? '...' }}
        </span>
        <span class="chip" :class="`index-${indexState}`" data-testid="index-chip">
          索引: {{ indexState }} ({{ componentCount }})
        </span>
        <button class="btn" data-testid="build-btn" :disabled="building" @click="onBuild">
          {{ building ? '构建中...' : '构建索引' }}
        </button>
        <button class="btn" data-testid="kb-debug-btn" @click="openKnowledgeDebug">
          知识库调试
        </button>
        <button
          class="ai-icon active"
          title="问 AI"
          data-testid="ai-icon"
        >
          🤖
        </button>
      </div>
    </header>

    <div v-if="errorMsg" class="error-bar" data-testid="error-bar">
      {{ errorMsg }}
    </div>

    <main class="content">
      <ChatView
        v-model:question="question"
        :index-ready="indexState === 'ready'"
      />
    </main>

    <ElDialog
      v-model="showKnowledgeDialog"
      title="知识库调试"
      width="86vw"
      class="kb-debug-dialog"
      data-testid="kb-debug-dialog"
    >
      <OverviewView
        v-if="debugView === 'overview'"
        :components="components"
        @open="openDetail"
      />
      <DetailView
        v-else
        :name="activeComponent"
        @back="debugView = 'overview'"
        @ask="askAbout"
      />
    </ElDialog>
  </div>
</template>

<style scoped>
.ai-doc-app {
  font-family: system-ui, sans-serif; color: #1f2328;
  height: 100vh; display: flex; flex-direction: column;
}
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; background: #0d1117; color: #fff;
  position: sticky; top: 0; z-index: 10;
}
.topbar h1 { font-size: 18px; margin: 0; }
.status-chips { display: flex; gap: 8px; align-items: center; }
.chip {
  font-size: 12px; padding: 4px 10px; border-radius: 999px;
  background: #30363d; color: #c9d1d9;
}
.chip.mode-vector { background: #1f6feb; color: #fff; }
.chip.index-ready { background: #238636; color: #fff; }
.chip.index-not_built { background: #6e7681; color: #fff; }
.btn {
  padding: 8px 14px; border: 1px solid #d0d7de; border-radius: 6px;
  background: #f6f8fa; cursor: pointer; font-size: 13px;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.ai-icon {
  border: none; background: #21262d; border-radius: 8px; cursor: pointer;
  font-size: 16px; padding: 6px 10px; line-height: 1;
}
.ai-icon.active { background: #238636; }
.error-bar {
  background: #ffebe9; color: #cf222e; padding: 8px 20px;
  font-size: 13px; border-bottom: 1px solid #ffccc7;
}
.content { flex: 1; overflow-y: auto; min-height: 0; }
.kb-debug-dialog :deep(.el-dialog__body) {
  max-height: min(72vh, 760px);
  overflow: auto;
  padding: 0;
}
</style>
