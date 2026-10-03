<script setup lang="ts">
import type { SourceFile } from '../generator'
import type { ConfigFormSourceViewerEmits, ConfigFormSourceViewerProps, SourceViewerPane } from './types'
import { Binary, Code2, FileCode2, Files, X } from '@lucide/vue'
import { computed, nextTick, ref, useId, watch } from 'vue'
import { SourceFileTree, SourceTextViewer } from './components'
import { buildSourceFileTree, decodedBase64ByteLength, sourceLanguageLabel } from './services'

const props = withDefaults(defineProps<ConfigFormSourceViewerProps>(), {
  theme: 'dark',
})
const emit = defineEmits<ConfigFormSourceViewerEmits>()

const viewerId = useId()
const treePaneId = `${viewerId}-tree-pane`
const codePaneId = `${viewerId}-code-pane`
const fileContentId = `${viewerId}-file-content`
const activePane = ref<SourceViewerPane>('tree')
const openPaths = ref<string[]>([])
const tabButtons = new Map<string, HTMLButtonElement>()
const labels = computed(() => ({
  files: 'Files',
  code: 'Code',
  openFiles: 'Open files',
  closeFile: 'Close',
  ...props.labels,
}))
const fileEntries = computed<readonly SourceFile[]>(() => props.files?.files ?? [])
const openFiles = computed(() => openPaths.value.flatMap(path => fileEntries.value.filter(file => file.path === path)))
const treeNodes = computed(() => buildSourceFileTree(fileEntries.value))
const selectedFile = computed(() => fileEntries.value.find(file => file.path === props.selectedPath))
const selectedLanguage = computed(() => {
  const file = selectedFile.value
  if (!file) return ''
  return file.kind === 'text' ? sourceLanguageLabel(file.language) : 'Binary'
})
const selectedByteLength = computed(() => {
  const file = selectedFile.value
  return file?.kind === 'binary' ? decodedBase64ByteLength(file.contentBase64) : 0
})

watch(
  [() => props.selectedPath, selectedFile],
  ([path, file]) => {
    if (path && file) {
      activePane.value = 'code'
      if (!openPaths.value.includes(path)) openPaths.value.push(path)
      void nextTick(() => tabButtons.get(path)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
    }
  },
  { immediate: true },
)

watch(fileEntries, files => (openPaths.value = openPaths.value.filter(path => files.some(file => file.path === path))))

function selectFile(path: string): void {
  emit('update:selectedPath', path)
  activePane.value = 'code'
}

function setTabRef(path: string, element: unknown): void {
  if (element instanceof HTMLButtonElement) tabButtons.set(path, element)
  else tabButtons.delete(path)
}

function closeFile(path: string): void {
  const files = openFiles.value
  const index = files.findIndex(file => file.path === path)
  if (files.length < 2 || index < 0) return
  openPaths.value = openPaths.value.filter(item => item !== path)
  if (path === props.selectedPath) {
    const next = files[index + 1] ?? files[index - 1]!
    selectFile(next.path)
    void nextTick(() => tabButtons.get(next.path)?.focus())
  } else {
    void nextTick(() => tabButtons.get(props.selectedPath)?.focus())
  }
}

function handleTabKeydown(event: KeyboardEvent, path: string): void {
  const files = openFiles.value
  const index = files.findIndex(file => file.path === path)
  if (event.key === 'Delete') {
    event.preventDefault()
    closeFile(path)
    return
  }
  let target: number
  if (event.key === 'ArrowLeft') target = (index - 1 + files.length) % files.length
  else if (event.key === 'ArrowRight') target = (index + 1) % files.length
  else if (event.key === 'Home') target = 0
  else if (event.key === 'End') target = files.length - 1
  else return
  event.preventDefault()
  const file = files[target]
  if (!file) return
  selectFile(file.path)
  tabButtons.get(file.path)?.focus()
}
</script>

<template>
  <section
    class="config-form-source-viewer"
    :data-active-pane="activePane"
    :data-theme="theme"
    aria-label="Generated source viewer"
  >
    <template v-if="fileEntries.length > 0">
      <div class="config-form-source-viewer__mobile-switch" role="group" aria-label="Viewer pane">
        <button
          type="button"
          :aria-controls="treePaneId"
          :aria-pressed="activePane === 'tree'"
          @click="activePane = 'tree'"
        >
          <Files :size="15" aria-hidden="true" />
          {{ labels.files }}
        </button>
        <button
          type="button"
          :aria-controls="codePaneId"
          :aria-pressed="activePane === 'code'"
          @click="activePane = 'code'"
        >
          <Code2 :size="15" aria-hidden="true" />
          {{ labels.code }}
        </button>
      </div>

      <div class="config-form-source-viewer__workspace">
        <aside :id="treePaneId" class="config-form-source-viewer__tree-pane" aria-label="Source files">
          <header class="config-form-source-viewer__pane-header">
            <span><Files :size="14" aria-hidden="true" />{{ labels.files }}</span>
            <span aria-label="File count">{{ fileEntries.length }}</span>
          </header>
          <SourceFileTree :nodes="treeNodes" :selected-path="selectedPath" @select="selectFile" />
        </aside>

        <section :id="codePaneId" class="config-form-source-viewer__code-pane" aria-label="Source code">
          <nav class="config-form-source-viewer__tabs" role="tablist" :aria-label="labels.openFiles">
            <div
              v-for="file in openFiles"
              :key="file.path"
              class="config-form-source-viewer__tab"
              :class="{ 'is-active': file.path === selectedPath }"
            >
              <button
                :ref="(element: unknown) => setTabRef(file.path, element)"
                type="button"
                role="tab"
                :aria-selected="file.path === selectedPath"
                :aria-controls="fileContentId"
                :tabindex="file.path === selectedPath ? 0 : -1"
                :title="file.path"
                @click="selectFile(file.path)"
                @keydown="handleTabKeydown($event, file.path)"
              >
                <FileCode2
                  :size="14"
                  :data-language="file.kind === 'text' ? file.language : 'binary'"
                  aria-hidden="true"
                />
                <span>{{ file.path.split('/').at(-1) }}</span>
              </button>
              <button
                v-if="openFiles.length > 1"
                type="button"
                class="config-form-source-viewer__tab-close"
                :title="`${labels.closeFile} ${file.path}`"
                :aria-label="`${labels.closeFile} ${file.path}`"
                @click="closeFile(file.path)"
              >
                <X :size="12" aria-hidden="true" />
              </button>
            </div>
          </nav>
          <header class="config-form-source-viewer__path-bar">
            <Code2 :size="15" aria-hidden="true" />
            <span class="config-form-source-viewer__path" :title="selectedPath || 'No file selected'">
              {{ selectedPath || 'No file selected' }}
            </span>
            <span v-if="selectedLanguage" class="config-form-source-viewer__language">
              {{ selectedLanguage }}
            </span>
            <slot name="file-actions" />
          </header>

          <div
            :id="fileContentId"
            class="config-form-source-viewer__file-content"
            role="tabpanel"
            :aria-label="selectedPath || labels.code"
          >
            <SourceTextViewer
              v-if="selectedFile?.kind === 'text'"
              :file="selectedFile"
              :theme="theme"
              :wrap-lines="wrapLines"
            />

            <div
              v-else-if="selectedFile?.kind === 'binary'"
              class="config-form-source-viewer__binary-state"
              role="status"
            >
              <Binary :size="28" aria-hidden="true" />
              <h2>Binary file</h2>
              <p>Embedded binary content is available in the exported file set.</p>
              <dl>
                <div>
                  <dt>Media type</dt>
                  <dd>{{ selectedFile.mediaType }}</dd>
                </div>
                <div>
                  <dt>Encoding</dt>
                  <dd>{{ selectedFile.encoding }}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{{ selectedByteLength }} bytes</dd>
                </div>
              </dl>
            </div>

            <div v-else class="config-form-source-viewer__missing-state" role="status">
              <Code2 :size="28" aria-hidden="true" />
              <h2>{{ selectedPath ? 'File unavailable' : 'No file selected' }}</h2>
              <p v-if="selectedPath" :title="selectedPath">The selected path is not part of this file set.</p>
              <p v-else>No source file is selected.</p>
            </div>
          </div>
        </section>
      </div>
    </template>

    <div v-else class="config-form-source-viewer__empty-state" role="status">
      <Files :size="30" aria-hidden="true" />
      <h2>No source files</h2>
      <p>No generated source file set is available.</p>
    </div>
  </section>
</template>
