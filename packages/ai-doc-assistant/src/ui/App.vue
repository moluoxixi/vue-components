<script setup lang="ts">
/**
 * AI 文档助手可视化面板（外壳）。
 *
 * 双视图工作区外壳：Chat 始终挂载，知识库作为同级视图承载总览与详情。
 */
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import type { ComponentListItem, HealthResponse, IndexState } from '../shared/protocol'
import { buildIndex, fetchComponents, fetchHealth, fetchStatus, importKnowledge } from './api'
import { readKnowledgeImportFile } from './export'
import WorkspaceTopbar, { type WorkspaceView } from './components/WorkspaceTopbar.vue'
import ChatView from './views/ChatView.vue'
import DetailView from './views/DetailView.vue'
import OverviewView from './views/OverviewView.vue'

type KnowledgeView = 'overview' | 'detail'
type RequestStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

const workspaceView = ref<WorkspaceView>('chat')
const knowledgeView = ref<KnowledgeView>('overview')
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
const healthStatus = ref<RequestStatus>('loading')
const componentsStatus = ref<RequestStatus>('idle')
const componentsError = ref('')
/** 知识库构建中标志。 */
const building = ref(false)
const importing = ref(false)
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

const statusLabel = computed(() => {
  if (healthStatus.value === 'loading')
    return '正在连接'
  if (healthStatus.value === 'error')
    return '连接失败'
  if (building.value || indexState.value === 'building')
    return '知识库更新中'
  if (componentsStatus.value === 'loading')
    return '正在加载组件'
  if (componentsStatus.value === 'error')
    return '组件加载失败'
  if (indexState.value === 'ready')
    return `知识库可用 · ${componentCount.value}`
  if (indexState.value === 'stale')
    return '知识库需更新'
  return '知识库未就绪'
})

const statusTone = computed<'neutral' | 'working' | 'success' | 'error'>(() => {
  if (healthStatus.value === 'error' || componentsStatus.value === 'error')
    return 'error'
  if (healthStatus.value === 'loading' || building.value || componentsStatus.value === 'loading')
    return 'working'
  return indexState.value === 'ready' ? 'success' : 'neutral'
})

const statusDetail = computed(() => {
  if (!health.value)
    return statusLabel.value
  const chat = health.value.providers.chat === 'configured' ? 'Chat 已配置' : 'Chat 未配置'
  return `${statusLabel.value} · 检索模式 ${health.value.mode} · ${chat}`
})

/** 拉取健康态与索引状态。 */
async function refreshHealth(): Promise<void> {
  healthStatus.value = 'loading'
  try {
    const [nextHealth, status] = await Promise.all([fetchHealth(), fetchStatus()])
    health.value = nextHealth
    indexState.value = status.state
    componentCount.value = status.componentCount
    healthStatus.value = 'ready'
  }
  catch (error) {
    healthStatus.value = 'error'
    throw error
  }
}

async function refreshComponents(): Promise<void> {
  componentsStatus.value = 'loading'
  componentsError.value = ''
  try {
    components.value = await fetchComponents()
    componentsStatus.value = components.value.length ? 'ready' : 'empty'
  }
  catch (error) {
    componentsStatus.value = 'error'
    componentsError.value = error instanceof Error ? error.message : String(error)
    throw error
  }
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
    await refreshComponents()
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
  workspaceView.value = 'knowledge'
}

/** 从详情跳到 Chat 并预填该组件的问题。 */
function askAbout(name: string): void {
  question.value = `${name} 怎么用？给个示例`
  workspaceView.value = 'chat'
  void nextTick(() => focusChat())
}

function openKnowledge(): void {
  knowledgeView.value = 'overview'
  workspaceView.value = 'knowledge'
}

function focusChat(): void {
  workspaceView.value = 'chat'
  void nextTick(() => chatViewRef.value?.focusQuestion())
}

async function onImportFile(file: File): Promise<void> {
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
      await refreshComponents()
    }
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
  finally {
    importing.value = false
  }
}

async function initialize(): Promise<void> {
  errorMsg.value = ''
  try {
    await refreshHealth()
    if (health.value?.mode === 'content' && indexState.value !== 'ready')
      await onBuild()
    else
      await refreshComponents()
  }
  catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err)
  }
}

onMounted(initialize)
</script>

<template>
  <div class="ai-doc-app">
    <WorkspaceTopbar
      :view="workspaceView"
      :status-label="statusLabel"
      :status-tone="statusTone"
      :status-detail="statusDetail"
      :chat-missing="health?.providers.chat === 'missing'"
      :building="building"
      :importing="importing"
      :show-build-action="showKnowledgeAction"
      :build-label="knowledgeActionLabel"
      @select-view="workspaceView = $event"
      @build="onBuild"
      @import-file="onImportFile"
    />

    <div v-if="errorMsg" class="error-bar" role="alert" data-testid="error-bar">
      <span>{{ errorMsg }}</span>
      <button type="button" @click="initialize">重试</button>
      <button type="button" aria-label="关闭错误提示" @click="errorMsg = ''">关闭</button>
    </div>

    <main class="workspace-content">
      <section
        id="workspace-chat-panel"
        v-show="workspaceView === 'chat'"
        class="workspace-pane chat-pane"
        role="tabpanel"
        aria-labelledby="workspace-chat-tab"
      >
        <ChatView
          ref="chatViewRef"
          v-model:question="question"
          :index-ready="indexState === 'ready'"
          :index-state="indexState"
          @open-source="openDetail"
        />
      </section>
      <section
        id="workspace-knowledge-panel"
        v-if="workspaceView === 'knowledge'"
        class="workspace-pane knowledge-pane"
        role="tabpanel"
        aria-labelledby="workspace-knowledge-tab"
        data-testid="knowledge-workspace"
      >
        <OverviewView
          v-if="knowledgeView === 'overview'"
          :components="components"
          :loading="componentsStatus === 'loading'"
          :error="componentsError"
          @retry="refreshComponents"
          @open="openDetail"
        />
        <DetailView
          v-else
          :name="activeComponent"
          @back="openKnowledge"
          @ask="askAbout"
        />
      </section>
    </main>
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
.error-bar {
  display: flex; align-items: center; gap: 12px;
  background: #ffebe9; color: #cf222e; padding: 8px 18px;
  font-size: 13px; border-bottom: 1px solid #ffccc7;
}
.error-bar span { min-width: 0; flex: 1; }
.error-bar button { padding: 3px 7px; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 12px; text-decoration: underline; }
.workspace-content { flex: 1; min-width: 0; min-height: 0; background: #fff; }
.workspace-pane { width: 100%; height: 100%; min-width: 0; min-height: 0; }
.knowledge-pane { overflow-y: auto; background: #f6f8fa; }

@media (max-width: 640px) {
  .error-bar { align-items: flex-start; gap: 8px; padding: 7px 10px; }
}
</style>
