<script setup lang="ts">
/**
 * AI 文档助手可视化面板（外壳）。
 *
 * 固定头部：标题 + /health 状态徽章（模式 / chat 配置态，不含密钥）+ 索引状态 +
 * 构建索引按钮 + AI 图标（任意视图一键进入 Chat）。
 * 视图用内部 ref 切换（零新依赖，不引 vue-router）：
 *   overview（搜索 + 卡片网格）→ detail（props/emits/slots/models + 类型展开）→ chat（流式问答）。
 */
import { onMounted, ref } from 'vue'
import type { ComponentListItem, HealthResponse } from '../shared/protocol'
import { buildIndex, fetchComponents, fetchHealth, fetchStatus } from './api'
import ChatView from './views/ChatView.vue'
import DetailView from './views/DetailView.vue'
import OverviewView from './views/OverviewView.vue'

/** 当前视图。 */
type View = 'overview' | 'detail' | 'chat'
const view = ref<View>('overview')
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
  view.value = 'detail'
}

/** 从详情跳到 Chat 并预填该组件的问题。 */
function askAbout(name: string): void {
  question.value = `${name} 怎么用？给个示例`
  view.value = 'chat'
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
      <h1 data-testid="app-title" @click="view = 'overview'">
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
        <button
          class="ai-icon"
          title="问 AI"
          data-testid="ai-icon"
          :class="{ active: view === 'chat' }"
          @click="view = 'chat'"
        >
          🤖
        </button>
      </div>
    </header>

    <div v-if="errorMsg" class="error-bar" data-testid="error-bar">
      {{ errorMsg }}
    </div>

    <main class="content">
      <OverviewView
        v-if="view === 'overview'"
        :components="components"
        @open="openDetail"
      />
      <DetailView
        v-else-if="view === 'detail'"
        :name="activeComponent"
        @back="view = 'overview'"
        @ask="askAbout"
      />
      <ChatView
        v-else
        v-model:question="question"
        :index-ready="indexState === 'ready'"
      />
    </main>
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
.topbar h1 { font-size: 18px; margin: 0; cursor: pointer; }
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
</style>
