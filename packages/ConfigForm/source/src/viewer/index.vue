<script setup lang="ts">
import type { SourceFile } from '../generator'
import type { ConfigFormSourceViewerEmits, ConfigFormSourceViewerProps, SourceViewerPane } from './types'
import { Binary, Code2, Files } from '@lucide/vue'
import { computed, ref, useId, watch } from 'vue'
import { SourceFileTree, SourceTextViewer } from './components'
import {
  buildSourceFileTree,
  decodedBase64ByteLength,
  sourceLanguageLabel,
} from './services'

const props = withDefaults(defineProps<ConfigFormSourceViewerProps>(), {
  theme: 'dark',
})
const emit = defineEmits<ConfigFormSourceViewerEmits>()

const viewerId = useId()
const treePaneId = `${viewerId}-tree-pane`
const codePaneId = `${viewerId}-code-pane`
const activePane = ref<SourceViewerPane>('tree')
const fileEntries = computed<readonly SourceFile[]>(() => props.files?.files ?? [])
const treeNodes = computed(() => buildSourceFileTree(fileEntries.value))
const selectedFile = computed(() => fileEntries.value.find(file => file.path === props.selectedPath))
const selectedLanguage = computed(() => {
  const file = selectedFile.value
  if (!file)
    return ''
  return file.kind === 'text' ? sourceLanguageLabel(file.language) : 'Binary'
})
const selectedByteLength = computed(() => {
  const file = selectedFile.value
  return file?.kind === 'binary' ? decodedBase64ByteLength(file.contentBase64) : 0
})

watch(
  [() => props.selectedPath, selectedFile],
  ([path, file]) => {
    if (path && file)
      activePane.value = 'code'
  },
  { immediate: true },
)

function selectFile(path: string): void {
  emit('update:selectedPath', path)
  activePane.value = 'code'
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
          Files
        </button>
        <button
          type="button"
          :aria-controls="codePaneId"
          :aria-pressed="activePane === 'code'"
          @click="activePane = 'code'"
        >
          <Code2 :size="15" aria-hidden="true" />
          Code
        </button>
      </div>

      <div class="config-form-source-viewer__workspace">
        <aside
          :id="treePaneId"
          class="config-form-source-viewer__tree-pane"
          aria-label="Source files"
        >
          <header class="config-form-source-viewer__pane-header">
            <span>Files</span>
            <span aria-label="File count">{{ fileEntries.length }}</span>
          </header>
          <SourceFileTree
            :nodes="treeNodes"
            :selected-path="selectedPath"
            @select="selectFile"
          />
        </aside>

        <section
          :id="codePaneId"
          class="config-form-source-viewer__code-pane"
          aria-label="Source code"
        >
          <header class="config-form-source-viewer__path-bar">
            <Code2 :size="15" aria-hidden="true" />
            <span class="config-form-source-viewer__path" :title="selectedPath || 'No file selected'">
              {{ selectedPath || 'No file selected' }}
            </span>
            <span v-if="selectedLanguage" class="config-form-source-viewer__language">
              {{ selectedLanguage }}
            </span>
          </header>

          <SourceTextViewer
            v-if="selectedFile?.kind === 'text'"
            :file="selectedFile"
            :theme="theme"
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
            <p v-if="selectedPath" :title="selectedPath">
              The selected path is not part of this file set.
            </p>
            <p v-else>No source file is selected.</p>
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
