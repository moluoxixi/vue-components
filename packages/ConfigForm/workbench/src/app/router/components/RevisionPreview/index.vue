<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createWorkbenchPreviewSession } from '../../../../session'
import { PreviewRuntimeHostFrame, loadRevisionPreview, openWorkbenchProjectRepository, isHttpWorkbenchRepository } from '../../..'
import { pageDesignPath, projectsPath } from '../../../navigation'
import './style/index.css'

const route = useRoute()
const preview = createWorkbenchPreviewSession()
const capture = shallowRef<Awaited<ReturnType<typeof loadRevisionPreview>>>()
const error = ref('')
const breakpoint = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
let requestId = 0
watch(() => route.fullPath, async () => {
  const request = ++requestId
  preview.clear(); capture.value = undefined; error.value = ''
  try {
    const repository = await openWorkbenchProjectRepository()
    try {
      if (!isHttpWorkbenchRepository(repository))
        throw new Error('版本预览需要连接本地工作区。请从本地服务或 MCP 打开预览链接。')
      const next = await loadRevisionPreview(repository, { projectId: String(route.params.projectId), repositoryRevision: Number(route.params.revision), surfaceId: String(route.params.surfaceId) })
      if (request === requestId) { capture.value = next; preview.accept(next) }
    }
    finally { repository.close() }
  }
  catch (failure) { if (request === requestId) error.value = failure instanceof Error ? failure.message : String(failure) }
}, { immediate: true })
onBeforeUnmount(() => { requestId++; preview.dispose() })
</script>

<template>
  <main class="revision-preview">
    <header class="revision-preview__toolbar">
      <strong>{{ capture?.name ?? '界面预览' }}</strong>
      <span class="revision-preview__version">版本 {{ route.params.revision }}</span>
      <span class="revision-preview__saved">已保存的界面</span>
      <div v-if="capture" class="revision-preview__devices" role="group" aria-label="预览尺寸">
        <button v-for="device in ([['desktop', '桌面'], ['tablet', '平板'], ['mobile', '手机']] as const)" :key="device[0]" :aria-pressed="breakpoint === device[0]" @click="breakpoint = device[0]">{{ device[1] }}</button>
      </div>
      <RouterLink :to="capture ? pageDesignPath(String(route.params.projectId), String(route.params.surfaceId)) : projectsPath()">{{ capture ? '编辑最新版本' : '返回项目' }}</RouterLink>
    </header>
    <div v-if="error || preview.error.value" class="revision-preview__message" role="alert">{{ error || preview.error.value?.message }}</div>
    <div v-else-if="capture && preview.compilation.value && preview.session.value" class="revision-preview__viewport" :data-breakpoint="breakpoint">
      <PreviewRuntimeHostFrame :adapter="capture.preset" :breakpoint="breakpoint" :compilation="preview.compilation.value" locale="zh-CN" :revision="preview.revision.value" :session="preview.session.value" :session-id="preview.sessionId.value" :title="capture.name"
        @error="preview.handleRuntimeError" @mounted="preview.handleRuntimeMounted" @ready="preview.handleRuntimeReady" @session="preview.handleSession" @instance-state="preview.handleInstanceState" />
    </div>
    <div v-else class="revision-preview__message" role="status">正在加载已保存的界面…</div>
  </main>
</template>
