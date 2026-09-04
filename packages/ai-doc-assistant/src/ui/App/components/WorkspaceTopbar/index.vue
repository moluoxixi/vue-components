<script setup lang="ts">
import { BookOpen, CircleAlert, MessageSquare, RefreshCw, Sparkles, Upload } from '@lucide/vue'
import { ElTooltip } from 'element-plus'
import { nextTick, useTemplateRef } from 'vue'

export type WorkspaceView = 'chat' | 'knowledge'

defineProps<{
  view: WorkspaceView
  statusLabel: string
  statusTone: 'neutral' | 'working' | 'success' | 'error'
  statusDetail: string
  chatMissing: boolean
  building: boolean
  importing: boolean
  showBuildAction: boolean
  buildLabel: string
}>()

const emit = defineEmits<{
  'select-view': [view: WorkspaceView]
  'build': []
  'import-file': [file: File]
}>()

const importInput = useTemplateRef<HTMLInputElement>('importInput')
const chatTab = useTemplateRef<HTMLButtonElement>('chatTab')
const knowledgeTab = useTemplateRef<HTMLButtonElement>('knowledgeTab')

function selectView(view: WorkspaceView, focus = false): void {
  emit('select-view', view)
  if (focus) {
    void nextTick(() => {
      const target = view === 'chat' ? chatTab.value : knowledgeTab.value
      target?.focus()
    })
  }
}

function onTabKeydown(event: KeyboardEvent): void {
  let target: WorkspaceView | undefined
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    target = event.currentTarget === chatTab.value ? 'knowledge' : 'chat'
  else if (event.key === 'Home')
    target = 'chat'
  else if (event.key === 'End')
    target = 'knowledge'
  if (!target)
    return
  event.preventDefault()
  selectView(target, true)
}

function chooseImportFile(): void {
  importInput.value?.click()
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    emit('import-file', file)
}
</script>

<template>
  <header class="workspace-topbar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"><Sparkles :size="17" /></span>
      <h1 data-testid="app-title">AI 文档助手</h1>
    </div>

    <nav class="workspace-tabs" role="tablist" aria-label="工作区视图">
      <button
        id="workspace-chat-tab"
        ref="chatTab"
        class="workspace-tab"
        :class="{ active: view === 'chat' }"
        type="button"
        role="tab"
        aria-controls="workspace-chat-panel"
        :aria-selected="view === 'chat'"
        :tabindex="view === 'chat' ? 0 : -1"
        data-testid="workspace-chat-tab"
        @click="selectView('chat')"
        @keydown="onTabKeydown"
      >
        <MessageSquare :size="16" />
        问答
      </button>
      <button
        id="workspace-knowledge-tab"
        ref="knowledgeTab"
        class="workspace-tab"
        :class="{ active: view === 'knowledge' }"
        type="button"
        role="tab"
        aria-controls="workspace-knowledge-panel"
        :aria-selected="view === 'knowledge'"
        :tabindex="view === 'knowledge' ? 0 : -1"
        data-testid="workspace-knowledge-tab"
        @click="selectView('knowledge')"
        @keydown="onTabKeydown"
      >
        <BookOpen :size="16" />
        知识库
      </button>
    </nav>

    <div class="workspace-actions">
      <ElTooltip :content="statusDetail" placement="bottom">
        <span class="status-pill" :class="`tone-${statusTone}`" role="status" data-testid="index-chip">
          <span class="status-dot" aria-hidden="true" />
          {{ statusLabel }}
        </span>
      </ElTooltip>
      <ElTooltip v-if="chatMissing" content="未配置 AI 对话服务" placement="bottom">
        <span class="chat-warning" role="status" data-testid="chat-warning">
          <CircleAlert :size="16" />
          <span class="wide-label">Chat 未配置</span>
        </span>
      </ElTooltip>
      <ElTooltip v-if="showBuildAction" :content="buildLabel" placement="bottom">
        <button
          class="icon-command"
          type="button"
          :aria-label="buildLabel"
          data-testid="build-btn"
          :disabled="building"
          @click="emit('build')"
        >
          <RefreshCw :size="17" :class="{ spinning: building }" />
        </button>
      </ElTooltip>
      <ElTooltip content="导入外部知识库 JSON" placement="bottom">
        <button
          class="icon-command"
          type="button"
          aria-label="导入外部知识库 JSON"
          data-testid="import-trigger"
          :disabled="importing"
          @click="chooseImportFile"
        >
          <Upload :size="17" />
        </button>
      </ElTooltip>
      <input
        ref="importInput"
        class="visually-hidden"
        type="file"
        accept="application/json,.json"
        data-testid="import-file-input"
        @change="onFileChange"
      >
    </div>
  </header>
</template>

<style scoped>
.workspace-topbar {
  z-index: 10;
  display: grid;
  min-height: 58px;
  grid-template-columns: minmax(170px, 1fr) auto minmax(170px, 1fr);
  align-items: center;
  gap: 16px;
  padding: 8px 18px;
  border-bottom: 1px solid #dfe3e8;
  background: #fff;
}
.brand,
.workspace-actions,
.workspace-tab,
.status-pill,
.chat-warning,
.icon-command { display: flex; align-items: center; }
.brand { min-width: 0; gap: 9px; }
.brand-mark {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 6px;
  background: #1769aa;
  color: #fff;
}
.brand h1 { overflow: hidden; margin: 0; color: #1f2328; font-size: 16px; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.workspace-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(92px, 1fr));
  padding: 3px;
  border: 1px solid #dfe3e8;
  border-radius: 7px;
  background: #f3f5f7;
}
.workspace-tab {
  min-height: 32px;
  justify-content: center;
  gap: 7px;
  padding: 5px 12px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #59636e;
  cursor: pointer;
  font-size: 13px;
}
.workspace-tab.active { background: #fff; box-shadow: 0 1px 3px rgba(31, 35, 40, .12); color: #0969da; font-weight: 600; }
.workspace-tab:focus-visible,
.icon-command:focus-visible { outline: 2px solid #409eff; outline-offset: 2px; }
.workspace-actions { min-width: 0; justify-content: flex-end; gap: 8px; }
.status-pill,
.chat-warning { min-height: 30px; gap: 7px; font-size: 12px; white-space: nowrap; }
.status-pill { padding: 4px 9px; border: 1px solid #dfe3e8; border-radius: 6px; color: #59636e; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #8c959f; }
.tone-working .status-dot { background: #bf8700; }
.tone-success .status-dot { background: #1a7f37; }
.tone-error .status-dot { background: #cf222e; }
.chat-warning { color: #9a6700; }
.icon-command {
  width: 32px;
  height: 32px;
  justify-content: center;
  padding: 0;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
  color: #59636e;
  cursor: pointer;
}
.icon-command:hover { border-color: #409eff; color: #0969da; }
.icon-command:disabled { cursor: wait; opacity: .55; }
.spinning { animation: spin 1s linear infinite; }
.visually-hidden { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 760px) {
  .workspace-topbar {
    min-height: 96px;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 40px 38px;
    gap: 4px 10px;
    padding: 6px 10px;
  }
  .workspace-tabs { grid-column: 1 / -1; grid-row: 2; }
  .workspace-actions { grid-column: 2; grid-row: 1; }
  .wide-label { display: none; }
  .status-pill { max-width: 126px; overflow: hidden; text-overflow: ellipsis; }
  .icon-command { width: 36px; height: 36px; }
}

@media (max-width: 420px) {
  .brand h1 { font-size: 14px; }
  .brand-mark { width: 28px; height: 28px; }
  .status-pill { max-width: 112px; padding-right: 7px; padding-left: 7px; }
}
</style>
