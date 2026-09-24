<script setup lang="ts">
import type { MonacoViewerSession, SourceTextFile } from '../types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadMonacoViewerRuntime } from '../services'

const props = defineProps<{
  file: SourceTextFile
  theme: 'dark' | 'light'
}>()

const containerRef = ref<HTMLElement>()
const loadState = ref<'error' | 'loading' | 'ready'>('loading')
const fallbackText = computed(() => props.file.content)
let activeRequest = 0
let session: MonacoViewerSession | undefined
let unmounted = false

function currentOptions() {
  return { file: props.file, theme: props.theme } as const
}

onMounted(async () => {
  const request = ++activeRequest
  try {
    const runtime = await loadMonacoViewerRuntime()
    if (unmounted || request !== activeRequest || !containerRef.value)
      return
    session = runtime.mount(containerRef.value, currentOptions())
    loadState.value = 'ready'
  }
  catch {
    if (!unmounted && request === activeRequest)
      loadState.value = 'error'
  }
})

watch(
  () => [props.file.path, props.file.language, props.file.content, props.theme] as const,
  () => session?.update(currentOptions()),
)

onBeforeUnmount(() => {
  unmounted = true
  activeRequest += 1
  session?.dispose()
  session = undefined
})
</script>

<template>
  <div
    class="config-form-source-viewer__text-viewer"
    role="region"
    :aria-label="`Read-only source: ${file.path}`"
    :aria-busy="loadState === 'loading'"
  >
    <div ref="containerRef" class="config-form-source-viewer__monaco" />
    <p v-if="loadState === 'loading'" class="config-form-source-viewer__load-state" role="status">
      Loading code viewer
    </p>
    <div v-else-if="loadState === 'error'" class="config-form-source-viewer__fallback">
      <p role="status">Code viewer unavailable. Showing plain text.</p>
      <pre tabindex="0">{{ fallbackText }}</pre>
    </div>
  </div>
</template>
