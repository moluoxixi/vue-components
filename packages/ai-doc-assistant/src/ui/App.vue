<script setup lang="ts">
/**
 * AI 文档助手可视化面板（外壳）。
 *
 * 固定头部：标题 + /health 状态徽章（模式 / chat 配置态，不含密钥）+ 知识库状态 +
 * 知识库入口。默认 content 模式在面板打开后自动准备知识库；vector 模式或未就绪时
 * 保留手动构建/更新入口。主区域默认且始终展示 Chat；组件总览/详情放进知识库弹框。
 */
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import type { ComponentListItem, HealthResponse, IndexState } from '../shared/protocol'
import { buildIndex, fetchComponents, fetchHealth, fetchStatus, importKnowledge } from './api'
import { readKnowledgeImportFile } from './export'
import ChatView from './views/ChatView.vue'
import DetailView from './views/DetailView.vue'
import OverviewView from './views/OverviewView.vue'

/** 知识库弹框内的视图。 */
type KnowledgeView = 'overview' | 'detail'
const knowledgeView = ref<KnowledgeView>('overview')
/** 是否打开知识库弹框。 */
const showKnowledgeDialog = ref(false)
/** 详情视图当前组件名。 */
const activeComponent = ref('')
/** Chat 视图预填问题（详情页「问 AI」带入）。 */
const question = ref('')

/** provider/模式/索引健康信息。 */
const health = ref<HealthResponse | null>(null)
/** 组件清单。 */
const components = ref<ComponentListItem[]>([])
/** 知识库状态。 */
const indexState = ref<IndexState>('not_built')
const componentCount = ref(0)
/** 错误信息（非空即展示红条）。 */
const errorMsg = ref('')
/** 知识库构建中标志。 */
const building = ref(false)
const importing = ref(false)
const importMenuOpen = ref(false)
const importInputRef = useTemplateRef<HTMLInputElement>('importInputRef')
const chatViewRef = useTemplateRef<InstanceType<typeof ChatView>>('chatViewRef')

/** 默认 content 模式不把构建动作暴露为常驻主按钮；vector 或未就绪时保留手动入口。 */
const showKnowledgeAction = computed(() =>
  health.value !== null && (health.value.mode !== 'content' || indexState.value !== 'ready'),
)

const knowledgeActionLabel = computed(() => {
  if (building.value)
    return '更新中...'
  return indexState.value === 'ready' ? '更新知识库' : '构建知识库'
})

/** 拉取健康态与索引状态。 */
async function refreshHealth(): Promise<void> {
  health.value = await fetchHealth()
  const status = await fetchStatus()
  indexState.value = status.state
  componentCount.value = status.componentCount
}

/** 触发知识库构建，完成后刷新状态与组件清单。 */
async function onBuild(): Promise<void> {
  const previousIndexState = indexState.value
  const previousComponentCount = componentCount.value
  building.value = true
  indexState.value = 'building'
  errorMsg.value = ''
  try {
    const status = await buildIndex()
    indexState.value = status.state
    componentCount.value = status.componentCount
  }
  catch (err) {
    indexState.value = previousIndexState
    componentCount.value = previousComponentCount
    errorMsg.value = err instanceof Error ? err.message : String(err)
    return
  }
  finally {
    building.value = false
  }

  try {
    components.value = await fetchComponents()
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errorMsg.value = `知识库已更新，但组件清单刷新失败：${message}`
  }
}

/** 从总览打开某组件详情。 */
function openDetail(name: string): void {
  activeComponent.value = name
  knowledgeView.value = 'detail'
  showKnowledgeDialog.value = true
}

/** 从详情跳到 Chat 并预填该组件的问题。 */
function askAbout(name: string): void {
  question.value = `${name} 怎么用？给个示例`
  showKnowledgeDialog.value = false
  void nextTick(() => focusChat())
}

/** 打开知识库弹框，用于检查当前知识库里有哪些组件契约。 */
function openKnowledge(): void {
  knowledgeView.value = 'overview'
  showKnowledgeDialog.value = true
}

function focusChat(): void {
  chatViewRef.value?.focusQuestion()
}

function chooseImportFile(): void {
  importMenuOpen.value = false
  importInputRef.value?.click()
}

async function onImportFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file)
    return
  importing.value = true
  errorMsg.value = ''
  try {
    const payload = await readKnowledgeImportFile(file)
    const first = await importKnowledge(payload)
    const result = first.status === 'conflict'
      ? (window.confirm(`外部知识库已存在 ${first.packageName}/${first.name}，是否覆盖外部版本？`)
          ? await importKnowledge(payload, true)
          : first)
      : first
    if (result.status !== 'conflict') {
      await refreshHealth()
      components.value = await fetchComponents()
    }
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    importing.value = false
  }
}

onMounted(async () => {
  try {
    await refreshHealth()
    if (health.value?.mode === 'content' && indexState.value !== 'ready')
      await onBuild()
    else
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
        <span class="chip" :class="health?.mode ? `mode-${health.mode}` : ''" data-testid="mode-chip">
          模式: {{ health?.mode ?? '...' }}
        </span>
        <span class="chip" data-testid="chat-chip">
          Chat: {{ health?.providers.chat ?? '...' }}
        </span>
        <span class="chip" :class="`index-${indexState}`" data-testid="index-chip">
          知识库: {{ indexState }} ({{ componentCount }})
        </span>
        <button v-if="showKnowledgeAction" class="btn" data-testid="build-btn" :disabled="building" @click="onBuild">
          {{ knowledgeActionLabel }}
        </button>
        <button class="btn" data-testid="kb-debug-btn" @click="openKnowledge">
          知识库
        </button>
        <span class="import-dropdown">
          <button
            class="btn"
            type="button"
            aria-haspopup="menu"
            :aria-expanded="importMenuOpen"
            data-testid="import-trigger"
            :disabled="importing"
            @click="importMenuOpen = !importMenuOpen"
            @keydown.esc="importMenuOpen = false"
          >
            {{ importing ? '导入中...' : '导入' }} ▾
          </button>
          <span v-if="importMenuOpen" class="import-menu" role="menu" data-testid="import-menu" @keydown.esc="importMenuOpen = false">
            <button class="import-option" type="button" role="menuitem" data-testid="import-external-json" @click="chooseImportFile">
              外部知识库 JSON
            </button>
          </span>
          <input
            ref="importInputRef"
            class="visually-hidden"
            type="file"
            accept="application/json,.json"
            data-testid="import-file-input"
            @change="onImportFile"
          >
        </span>
        <button
          class="ai-icon active"
          type="button"
          title="问 AI"
          aria-label="聚焦 AI 提问输入框"
          data-testid="ai-icon"
          @click="focusChat"
        >
          AI
        </button>
      </div>
    </header>

    <div v-if="errorMsg" class="error-bar" data-testid="error-bar">
      {{ errorMsg }}
    </div>

    <main class="content">
      <ChatView
        ref="chatViewRef"
        v-model:question="question"
        :index-ready="indexState === 'ready'"
        :index-state="indexState"
        @open-source="openDetail"
      />
    </main>

    <ElDialog
      v-model="showKnowledgeDialog"
      title="知识库"
      width="86vw"
      class="kb-debug-dialog"
      data-testid="kb-debug-dialog"
    >
      <OverviewView
        v-if="knowledgeView === 'overview'"
        :components="components"
        @open="openDetail"
      />
      <DetailView
        v-else
        :name="activeComponent"
        @back="knowledgeView = 'overview'"
        @ask="askAbout"
      />
    </ElDialog>
  </div>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
}

.ai-doc-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  color: #303133;
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}
.topbar h1 { margin: 0; color: #303133; font-size: 18px; font-weight: 650; }
.topbar h1::before { content: ''; display: inline-block; width: 4px; height: 18px; margin-right: 10px; border-radius: 2px; background: #409eff; vertical-align: -3px; }
.status-chips { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.chip {
  padding: 4px 9px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
}
.chip.mode-vector { border-color: #b3d8ff; background: #ecf5ff; color: #337ecc; }
.chip.index-ready { border-color: #b3e19d; background: #f0f9eb; color: #529b2e; }
.chip.index-not_built { color: #909399; }
.btn {
  padding: 7px 12px; border: 1px solid #dcdfe6; border-radius: 4px;
  background: #fff; color: #606266; cursor: pointer; font-size: 13px;
}
.btn:hover { border-color: #409eff; color: #409eff; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.import-dropdown { position: relative; display: inline-flex; }
.import-menu {
  position: absolute; top: 36px; right: 0; z-index: 20;
  min-width: 150px; padding: 6px; border: 1px solid #d0d7de; border-radius: 8px;
  background: #fff; box-shadow: 0 8px 24px rgba(140,149,159,.28);
}
.import-option {
  display: block; width: 100%; padding: 8px 10px; border: 0; border-radius: 6px;
  background: transparent; color: #1f2328; cursor: pointer; text-align: left; white-space: nowrap;
}
.import-option:hover { background: #f6f8fa; }
.visually-hidden { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.ai-icon {
  display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center;
  border: 1px solid #409eff; background: #fff; border-radius: 4px; color: #409eff;
  cursor: pointer; font-size: 11px; font-weight: 700; line-height: 1;
}
.ai-icon.active { background: #409eff; color: #fff; }
.error-bar {
  background: #ffebe9; color: #cf222e; padding: 8px 20px;
  font-size: 13px; border-bottom: 1px solid #ffccc7;
}
.content { flex: 1; overflow-y: auto; min-height: 0; background: #fff; }
.kb-debug-dialog :deep(.el-dialog__body) {
  max-height: min(72vh, 760px);
  overflow: auto;
  padding: 0;
}

@media (max-width: 900px) {
  .topbar { align-items: flex-start; flex-direction: column; }
  .status-chips { width: 100%; justify-content: flex-start; }
}
</style>
