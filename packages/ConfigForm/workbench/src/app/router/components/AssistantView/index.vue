<script setup lang="ts">
import type { AssistantStatus, LivePreviewSession } from '@moluoxixi/config-form-studio/client'
import type { RevisionPreviewCapture } from '../../../types/revision-preview'
import { ArrowLeft, Check, MessageSquare, Monitor, Send, Smartphone, Square, Undo2, X } from '@lucide/vue'
import { WORKSPACE_API_PATH, WORKSPACE_REQUEST_HEADER, workspaceRequest } from '@moluoxixi/config-form-studio/client'
import { ElMessageBox } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import WorkbenchCommandHint from '../../../../components/WorkbenchCommandHint/index.vue'
import { createWorkbenchPreviewSession } from '../../../../session'
import { PreviewRuntimeHostFrame } from '../../../components'
import { useWorkbenchUiStore } from '../../../composables'
import { pageDesignPath } from '../../../navigation'
import { discoverWorkspaceUrl, openWorkbenchProjectRepository, prepareRevisionPreview } from '../../../services'
import ManagementShell from '../ManagementShell.vue'

const route = useRoute()
const router = useRouter()
const ui = useWorkbenchUiStore()
const preview = createWorkbenchPreviewSession()
const capture = shallowRef<RevisionPreviewCapture>()
const state = shallowRef<LivePreviewSession>()
const status = ref<AssistantStatus>({ configured: false })
const workspace = ref<string>()
const serviceAddress = ref('http://127.0.0.1:4332')
const serviceLink = computed(() => {
  try {
    const url = new URL(serviceAddress.value)
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && !url.username && !url.password ? `${url.origin}/#/assistant/new` : undefined
  }
  catch { return undefined }
})
const connected = ref(false)
const loading = ref(true)
const pending = ref(false)
const sending = ref(false)
const text = ref('')
const error = ref('')
const mobileTab = ref<'chat' | 'preview'>('chat')
const compactScreen = window.matchMedia('(max-width: 48rem)')
const breakpoint = ref<'desktop' | 'mobile'>(compactScreen.matches ? 'mobile' : 'desktop')
function syncPreviewDevice(event: MediaQueryListEvent): void {
  breakpoint.value = event.matches ? 'mobile' : 'desktop'
}
compactScreen.addEventListener('change', syncPreviewDevice)
onBeforeUnmount(() => compactScreen.removeEventListener('change', syncPreviewDevice))
const preset = ref<'element-plus' | 'antd-vue'>('element-plus')
const messagesElement = useTemplateRef<HTMLElement>('messagesElement')
let events: EventSource | undefined
let chatAbort: AbortController | undefined
let disposed = false
let ending = false
let creating = false
let loadRequest = 0
let resourceUrls: Record<string, string> = {}
let resourceSignature = ''
let loadedCapture = ''
const busy = computed(() => pending.value || sending.value || Boolean(state.value?.busy))
const blocked = computed(() => loading.value ? '正在连接工作区，连接成功后即可操作。' : !connected.value ? '工作区连接已断开，恢复连接后即可操作。' : busy.value ? '正在生成或保存，完成后即可操作。' : undefined)
const sendReason = computed(() => blocked.value || (!status.value.configured ? '本地服务尚未配置 AI。配置服务商、模型和密钥并重启后即可对话。' : !text.value.trim() ? '输入你的表单需求后即可发送。' : undefined))
const saveReason = computed(() => blocked.value || (!state.value?.dirty ? '当前没有待保存的修改。' : undefined))
const undoReason = computed(() => blocked.value || (!state.value?.canUndo ? '生成第一批修改后即可撤销。' : undefined))

function request<T>(path: string, input: unknown): Promise<T> {
  return workspaceRequest<T>(`${workspace.value}${WORKSPACE_API_PATH}${path}`, input)
}
async function accept(next: LivePreviewSession): Promise<void> {
  if (disposed || ending || next.id !== String(route.params.sessionId))
    return
  state.value = next
  const captureId = `${next.id}:${next.revision}`
  if (loadedCapture === captureId)
    return
  const resources = Object.values(next.document.resources).filter(resource => resource.kind === 'embedded')
  const signature = JSON.stringify([next.document.id, resources])
  if (next.savedRevision !== undefined && resourceSignature !== signature) {
    const repository = await openWorkbenchProjectRepository()
    try {
      const entries = await Promise.all(resources.map(async (resource) => {
        if (resource.kind !== 'embedded')
          return ['', '']
        const bytes = await repository.readEmbedded({ projectId: next.document.id, resourceId: resource.id, contentHash: resource.contentHash })
        if (!bytes)
          throw new Error(`图片已不可用：${resource.name}`)
        let binary = ''
        for (let offset = 0; offset < bytes.length; offset += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
        return [resource.id, `data:${resource.mediaType};base64,${btoa(binary)}`]
      }))
      resourceUrls = Object.fromEntries(entries)
      resourceSignature = signature
    }
    finally { repository.close() }
  }
  if (disposed || next.id !== state.value?.id || next.revision !== state.value.revision)
    return
  const nextCapture = prepareRevisionPreview({ document: next.document, repositoryRevision: next.revision, surfaceId: next.surfaceId, resourceUrls })
  capture.value = { ...nextCapture, sessionId: `live:${captureId}`, revision: `live:${captureId}` }
  preview.accept(capture.value)
  loadedCapture = captureId
}
async function refresh(): Promise<void> {
  const id = String(route.params.sessionId)
  if (id === 'new' || !workspace.value || ending)
    return
  const requestId = ++loadRequest
  try {
    const next = await request<LivePreviewSession>('/preview-session/read', { sessionId: id })
    if (requestId === loadRequest)
      await accept(next)
  }
  catch (reason) {
    if (!disposed && !ending)
      error.value = (reason as Error).message
  }
}
async function createSession(): Promise<void> {
  const projectId = typeof route.query.projectId === 'string' ? route.query.projectId : undefined
  const project = projectId ? await request<{ repositoryRevision: number }>('/repository', { method: 'get', args: [projectId] }) : undefined
  const created = await request<LivePreviewSession>('/preview-session/create', { preset: preset.value, name: 'AI 表单', ...(projectId ? { projectId, expectedRepositoryRevision: project?.repositoryRevision } : {}) })
  creating = true
  try {
    await router.replace(`/assistant/${created.id}`)
    await accept(created)
  }
  finally { creating = false }
}
async function action(kind: 'undo' | 'save'): Promise<void> {
  if (!state.value || blocked.value)
    return
  pending.value = true
  error.value = ''
  try {
    await accept(await request<LivePreviewSession>(`/preview-session/${kind}`, { sessionId: state.value.id, expectedSessionRevision: state.value.revision }))
  }
  catch (reason) { error.value = (reason as Error).message }
  finally { pending.value = false }
}
async function send(): Promise<void> {
  if (sendReason.value)
    return
  const message = text.value.trim()
  sending.value = true
  error.value = ''
  const abort = new AbortController()
  chatAbort = abort
  try {
    if (!state.value)
      await createSession()
    const current = state.value!
    text.value = ''
    const response = await fetch(`${workspace.value}${WORKSPACE_API_PATH}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [WORKSPACE_REQUEST_HEADER]: '1' },
      body: JSON.stringify({ sessionId: current.id, expectedSessionRevision: current.revision, message }),
      signal: abort.signal,
    })
    if (!response.ok) {
      const failure = await response.json()
      throw new Error(failure.error?.message || '无法发送消息，请重试。')
    }
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let answerId = ''
    let answerText = ''
    while (true) {
      const chunk = await reader.read()
      if (chunk.done)
        break
      buffer += decoder.decode(chunk.value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const event = JSON.parse(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (event.type === 'started') {
          answerId = event.messageId
          await refresh()
        }
        if (event.type === 'preview')
          await refresh()
        if (event.type === 'text' && state.value) {
          answerText += event.text
          const messages = state.value.messages.map(item => item.id === answerId ? { ...item, text: item.text.length > answerText.length ? item.text : answerText } : item)
          state.value = { ...state.value, messages }
        }
        if (event.type === 'error')
          error.value = event.message
        await nextTick()
        if (messagesElement.value)
          messagesElement.value.scrollTop = messagesElement.value.scrollHeight
      }
    }
  }
  catch (reason) {
    if (!abort.signal.aborted) {
      error.value = (reason as Error).message
      text.value ||= message
    }
  }
  finally {
    sending.value = false
    chatAbort = undefined
    await refresh()
  }
}
async function stop(): Promise<void> {
  chatAbort?.abort()
  if (state.value)
    await request('/preview-session/stop', { sessionId: state.value.id }).catch((reason) => { error.value = reason.message })
}
async function confirmLeave(): Promise<boolean> {
  if (ending || creating || (!state.value?.dirty && !busy.value))
    return true
  try {
    await ElMessageBox.confirm('预览尚未保存。离开后可通过本会话链接继续；关闭本地服务会丢失草稿。', '离开预览草稿？', {
      confirmButtonText: '离开',
      cancelButtonText: '继续编辑',
      appendTo: '#workbench-overlays',
      closeOnClickModal: false,
    })
    return true
  }
  catch { return false }
}
async function endSession(): Promise<void> {
  if (!state.value || blocked.value)
    return
  if (state.value.dirty) {
    try {
      await ElMessageBox.confirm('结束后将丢弃本会话中尚未保存的修改。已保存的项目会保留。', '结束会话？', {
        confirmButtonText: '结束并丢弃草稿',
        cancelButtonText: '继续编辑',
        type: 'warning',
        appendTo: '#workbench-overlays',
        closeOnClickModal: false,
      })
    }
    catch {
      return
    }
  }
  pending.value = true
  try {
    ending = true
    await request('/preview-session/close', { sessionId: state.value.id })
    await router.push('/projects')
  }
  catch (reason) {
    ending = false
    error.value = (reason as Error).message
  }
  finally { pending.value = false }
}
function leave(event: BeforeUnloadEvent): void {
  if (state.value?.dirty || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)
watch(() => route.params.sessionId, () => {
  loadRequest++
  state.value = undefined
  capture.value = undefined
  resourceUrls = {}
  resourceSignature = ''
  loadedCapture = ''
  error.value = ''
  void refresh()
})
void (async () => {
  try {
    workspace.value = await discoverWorkspaceUrl()
    if (!workspace.value)
      return
    status.value = await request<AssistantStatus>('/ai/status', {})
    events = new EventSource(`${workspace.value}${WORKSPACE_API_PATH}/events`)
    events.onopen = () => {
      connected.value = true
      void refresh()
    }
    events.onerror = () => {
      connected.value = false
    }
    events.onmessage = (event) => {
      const change = JSON.parse(event.data)
      if (change.kind === 'reset' || change.sessionId === route.params.sessionId)
        void refresh()
    }
    connected.value = true
    if (route.params.sessionId === 'new' && route.query.projectId)
      await createSession()
    else
      await refresh()
  }
  catch (reason) { error.value = (reason as Error).message }
  finally { loading.value = false }
})()
window.addEventListener('beforeunload', leave)
onBeforeUnmount(() => {
  disposed = true
  events?.close()
  chatAbort?.abort()
  preview.dispose()
  window.removeEventListener('beforeunload', leave)
})
</script>

<template>
  <ManagementShell :palette="ui.paletteFamily.value" :theme="ui.resolvedTheme.value">
    <main class="assistant-workspace" aria-label="AI 表单工作区">
      <header class="assistant-heading">
        <RouterLink to="/projects" class="assistant-back" aria-label="返回项目">
          <ArrowLeft :size="18" />
        </RouterLink>
        <div class="min-w-0">
          <h1 class="truncate">
            {{ state?.document.name || 'AI 表单' }}
          </h1><p>{{ state ? (state.dirty ? '预览草稿 · 保存后保留到项目' : '已保存到本地项目') : '描述需求，边对话边预览' }}</p>
        </div>
        <div v-if="workspace" class="flex items-center gap-2 ml-auto">
          <WorkbenchCommandHint detached label="撤销上一批修改" :disabled-reason="undoReason">
            <ElButton :disabled="Boolean(undoReason)" aria-label="撤销上一批修改" @click="action('undo')">
              <Undo2 :size="16" />
            </ElButton>
          </WorkbenchCommandHint>
          <WorkbenchCommandHint detached label="保存到项目" :disabled-reason="saveReason">
            <ElButton type="primary" :disabled="Boolean(saveReason)" @click="action('save')">
              <Check :size="16" />保存
            </ElButton>
          </WorkbenchCommandHint>
          <RouterLink v-if="state?.savedRevision !== undefined && !state.dirty && !busy" :to="pageDesignPath(state.document.id, state.surfaceId)" class="assistant-edit">
            继续设计
          </RouterLink>
          <WorkbenchCommandHint v-if="state" detached label="结束会话；已保存的项目会保留" :disabled-reason="blocked">
            <ElButton :disabled="Boolean(blocked)" aria-label="结束会话" @click="endSession">
              <X :size="16" />
            </ElButton>
          </WorkbenchCommandHint>
        </div>
      </header>
      <p v-if="error" role="alert" class="assistant-error">
        {{ error }}
      </p>
      <div v-if="loading" class="assistant-empty" role="status">
        正在连接工作区…
      </div>
      <section v-else-if="!workspace" class="assistant-connect">
        <MessageSquare :size="28" aria-hidden="true" /><h2>打开 AI 工作区</h2>
        <p>AI 对话和 MCP 共用本地工作区。表单文件保存在你指定的目录，模型密钥由本地服务管理。</p>
        <code>config-form serve --workspace ./config-form-workspace</code>
        <label for="assistant-service">本地服务地址</label><ElInput id="assistant-service" v-model="serviceAddress" placeholder="http://127.0.0.1:4332" />
        <a v-if="serviceLink" :href="serviceLink" class="assistant-connect-link">打开工作区</a><p v-else role="alert">
          请输入 localhost 或 127.0.0.1 的 HTTP 地址。
        </p>
        <p class="text-xs">
          浏览器里的项目会保留；需要继续编辑时，可先导出项目 JSON，再导入本地工作区。
        </p>
      </section>
      <template v-else>
        <div class="assistant-mobile-tabs" role="tablist" aria-label="对话与预览">
          <button v-for="tab in (['chat', 'preview'] as const)" :key="tab" role="tab" :aria-selected="mobileTab === tab" @click="mobileTab = tab">
            {{ tab === 'chat' ? '对话' : '实时预览' }}<span v-if="tab === 'preview' && state" class="ml-1">{{ state.revision }}</span>
          </button>
        </div>
        <div class="assistant-body" :data-mobile-tab="mobileTab">
          <section class="assistant-chat" aria-label="AI 对话">
            <div class="assistant-chat-heading">
              <MessageSquare :size="16" /><strong>对话</strong><span class="ml-auto truncate">{{ status.configured ? status.model : 'MCP 可用' }}</span>
            </div>
            <div ref="messagesElement" class="assistant-messages" aria-live="polite">
              <div v-if="!state?.messages.length" class="assistant-welcome">
                <h2>先描述你的表单</h2><p>字段、校验、布局都可以继续调整，每批修改会直接显示在右侧。</p><p class="text-xs">
                  例如：做一个请假申请表，包含姓名、部门、请假日期和原因。
                </p>
              </div>
              <article v-for="message in state?.messages" :key="message.id" class="assistant-message" :data-role="message.role">
                <span class="assistant-message-role">{{ message.role === 'user' ? '你' : message.role === 'update' ? '预览已更新' : 'AI' }}</span><p>{{ message.text || '正在思考…' }}</p>
              </article>
              <p v-if="!status.configured" class="assistant-config-hint">
                本地服务尚未配置 AI。设置 CONFIG_FORM_AI_API_FORMAT、CONFIG_FORM_AI_MODEL 和 CONFIG_FORM_AI_API_KEY 后重启；兼容网关还需 CONFIG_FORM_AI_BASE_URL。也可在 AI 客户端通过 MCP 生成，此界面会实时更新。
              </p>
            </div>
            <form class="assistant-composer" @submit.prevent="send">
              <label v-if="!state" class="flex items-center justify-between gap-2 text-xs">组件库<ElSelect v-model="preset" aria-label="组件库" class="max-w-48"><ElOption value="element-plus" label="Element Plus" /><ElOption value="antd-vue" label="Ant Design Vue" /></ElSelect></label>
              <ElInput v-model="text" type="textarea" :rows="3" maxlength="8000" resize="none" aria-label="描述表单需求" placeholder="描述表单，或继续提出修改…" @keydown.ctrl.enter.prevent="send" @keydown.meta.enter.prevent="send" />
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-[var(--wb-muted)]">{{ connected ? '草稿可撤销' : '连接中断，正在重连…' }}</span><ElButton v-if="sending || state?.busy" @click="stop">
                  <Square :size="14" />停止
                </ElButton><WorkbenchCommandHint v-else detached label="发送需求" shortcut="Ctrl / ⌘ Enter" :disabled-reason="sendReason">
                  <ElButton native-type="submit" type="primary" :disabled="Boolean(sendReason)">
                    <Send :size="15" />发送
                  </ElButton>
                </WorkbenchCommandHint>
              </div>
            </form>
          </section>
          <section class="assistant-preview" aria-label="实时表单预览">
            <div class="assistant-preview-heading">
              <strong>实时预览</strong><span class="text-xs text-[var(--wb-muted)]">{{ state ? `第 ${state.revision} 次更新` : '等待生成' }}</span><div class="flex gap-1 ml-auto">
                <WorkbenchCommandHint v-for="device in (['desktop', 'mobile'] as const)" :key="device" :label="device === 'desktop' ? '桌面预览' : '手机预览'">
                  <button :aria-label="device === 'desktop' ? '桌面预览' : '手机预览'" :aria-pressed="breakpoint === device" class="assistant-device" @click="breakpoint = device">
                    <component :is="device === 'desktop' ? Monitor : Smartphone" :size="16" />
                  </button>
                </WorkbenchCommandHint>
              </div>
            </div>
            <p v-if="preview.error.value" role="alert" class="assistant-error">
              {{ preview.error.value.message }}
            </p>
            <div v-else-if="capture && preview.compilation.value && preview.session.value" class="assistant-preview-viewport" :data-breakpoint="breakpoint">
              <PreviewRuntimeHostFrame :adapter="capture.preset" :breakpoint="breakpoint" :compilation="preview.compilation.value" :locale="ui.localeId.value" :revision="preview.revision.value" :session="preview.session.value" :session-id="preview.sessionId.value" :title="capture.name" @error="preview.handleRuntimeError" @mounted="preview.handleRuntimeMounted" @ready="preview.handleRuntimeReady" @session="preview.handleSession" @instance-state="preview.handleInstanceState" />
            </div>
            <div v-else class="assistant-empty">
              <Monitor :size="32" aria-hidden="true" /><strong>表单会在这里实时出现</strong><p>对话生成和 MCP 修改使用同一个预览，无需刷新页面。</p>
            </div>
          </section>
        </div>
      </template>
    </main>
  </ManagementShell>
</template>

<style src="./style.css" scoped />
