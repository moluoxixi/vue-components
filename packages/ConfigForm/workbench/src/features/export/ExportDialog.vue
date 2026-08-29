<script setup lang="ts">
import type {
  DesignerLocaleOptions,
  LowCodeComponentRegistry,
} from '@moluoxixi/config-form-designer'
import type {
  ExportSnapshot,
  ProjectPath,
  WorkspaceFile,
} from '../../project'
import type { WorkspaceProjectionSnapshot } from '../../session'
import {
  Clipboard,
  Download,
  Files,
  RefreshCw,
  X,
} from '@lucide/vue'
import { computed, defineAsyncComponent, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import ProjectFileTree from '../../components/ProjectFileTree.vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'
import {
  buildProjectFileTree,
  collectProjectTreeDirectoryIds,
  createExportSnapshot,
  createWorkspaceApplicationSourceExport,
  downloadWorkspaceArchive,
  isExportSnapshotStale,
  normalizeProjectPath,
  resolveExportSnapshotPath,
  WORKSPACE_CONFIG_MODULE_PATH,
} from '../../project'
import { formatLowCodePageConfig } from '../../workbench/config-codec'

export type ExportMode = 'source' | 'config'
type ConfigViewMode = 'source' | 'json' | 'tree'

interface ConfigTreeEntry {
  branch: boolean
  depth: number
  path: string
  value: string
}

const props = defineProps<{
  capture: () => WorkspaceProjectionSnapshot | undefined
  currentRevisionKey: string
  locale?: DesignerLocaleOptions
  mode?: ExportMode
  registry: LowCodeComponentRegistry
  theme: 'dark' | 'light'
}>()

const emit = defineEmits<{
  close: []
  message: [message: string]
}>()

const WorkspaceCodeEditor = defineAsyncComponent(() => import('../../components/WorkspaceCodeEditor.vue'))
const SOURCE_PATH = normalizeProjectPath('src/App.vue')
const CONFIG_PATH = WORKSPACE_CONFIG_MODULE_PATH
const dialog = useTemplateRef<HTMLElement>('dialog')
const projection = shallowRef<WorkspaceProjectionSnapshot>()
const sourceSnapshot = shallowRef<ExportSnapshot>()
const sourceSnapshotError = ref('')
const sourceViewPath = ref<ProjectPath>(SOURCE_PATH)
const sourceTreeExpandedIds = ref<string[]>([])
const sourceMobileView = ref<'tree' | 'code'>('tree')
const configViewMode = ref<ConfigViewMode>('source')
const locale = computed(() => createDesignerLocale(props.locale))
const { handleKeydown } = useWorkbenchDialogFocus(
  () => !!props.mode,
  dialog,
  () => emit('close'),
)

const projectionStale = computed(() => !!projection.value
  && projection.value.revisionKey !== props.currentRevisionKey)
const sourceSnapshotStale = computed(() => isExportSnapshotStale(
  sourceSnapshot.value,
  projection.value?.application.id,
  props.currentRevisionKey,
))
const sourceFileTree = computed(() => sourceSnapshot.value
  ? buildProjectFileTree(sourceSnapshot.value.files)
  : [])
const selectedSourceFile = computed<WorkspaceFile | undefined>(() => sourceSnapshot.value?.files[sourceViewPath.value])
const sourceCode = computed(() => selectedSourceFile.value?.kind === 'text' ? selectedSourceFile.value.content : '')
const sourceLanguage = computed(() => {
  const file = selectedSourceFile.value
  if (file?.kind === 'text' && file.language)
    return file.language
  if (sourceViewPath.value.endsWith('.vue')) return 'vue'
  if (sourceViewPath.value.endsWith('.json')) return 'json'
  if (sourceViewPath.value.endsWith('.css')) return 'css'
  if (sourceViewPath.value.endsWith('.html')) return 'html'
  return 'typescript'
})
const configModel = computed(() => projection.value?.currentPage.model)
const generatedConfigSource = computed(() => configModel.value
  ? formatLowCodePageConfig(configModel.value, props.registry)
  : '')
const generatedConfigJson = computed(() => configModel.value
  ? `${JSON.stringify(configModel.value, null, 2)}\n`
  : '')
const generatedConfigTree = computed<ConfigTreeEntry[]>(() => {
  if (!configModel.value)
    return []
  const entries: ConfigTreeEntry[] = []
  const visit = (value: unknown, path: string, depth: number): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth))
      return
    }
    if (typeof value !== 'object' || value === null)
      return
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key
      const branch = typeof child === 'object' && child !== null
      entries.push({
        branch,
        depth,
        path: childPath,
        value: branch ? (Array.isArray(child) ? `[${child.length}]` : '{...}') : JSON.stringify(child),
      })
      if (branch)
        visit(child, childPath, depth + 1)
    }
  }
  visit(configModel.value, '', 0)
  return entries
})

watch(() => props.mode, (mode) => {
  if (!mode)
    return
  if (mode === 'source') {
    sourceViewPath.value = SOURCE_PATH
    sourceMobileView.value = 'tree'
    sourceSnapshot.value = undefined
    sourceSnapshotError.value = ''
    refreshSourceSnapshot()
  }
  else {
    configViewMode.value = 'source'
    refreshConfigSnapshot()
  }
}, { immediate: true })

function refreshConfigSnapshot(): void {
  const next = props.capture()
  if (next)
    projection.value = next
}

function refreshSourceSnapshot(): void {
  const nextProjection = props.capture()
  if (!nextProjection)
    return
  try {
    const exported = createWorkspaceApplicationSourceExport(
      nextProjection.application,
      props.registry,
    )
    const next = createExportSnapshot({
      applicationId: nextProjection.application.id,
      applicationName: nextProjection.application.name,
      applicationRevision: nextProjection.applicationRevision,
      entry: SOURCE_PATH,
      files: exported.files,
      modelRevision: nextProjection.modelRevision,
      revisionKey: nextProjection.revisionKey,
    })
    projection.value = nextProjection
    sourceSnapshot.value = next
    sourceSnapshotError.value = ''
    sourceViewPath.value = resolveExportSnapshotPath(next, sourceViewPath.value) ?? SOURCE_PATH
    sourceTreeExpandedIds.value = collectProjectTreeDirectoryIds(buildProjectFileTree(next.files))
  }
  catch (error) {
    sourceSnapshotError.value = error instanceof Error ? error.message : String(error)
  }
}

function selectSourcePath(path: ProjectPath): void {
  sourceViewPath.value = path
  sourceMobileView.value = 'code'
}

function exportText(): string {
  if (props.mode === 'source')
    return sourceCode.value
  return configViewMode.value === 'source' ? generatedConfigSource.value : generatedConfigJson.value
}

async function copyExport(): Promise<void> {
  if (props.mode === 'source' && !sourceSnapshot.value) {
    emit('message', sourceSnapshotError.value)
    return
  }
  try {
    if (!navigator.clipboard)
      throw new Error(locale.value.t('export.clipboardUnavailable', 'Clipboard API is unavailable.'))
    await navigator.clipboard.writeText(exportText())
    emit('message', locale.value.t('export.copied', 'Copied export to clipboard'))
  }
  catch (error) {
    emit('message', error instanceof Error ? error.message : locale.value.t('export.unableCopy', 'Unable to copy export.'))
  }
}

function downloadCurrent(): void {
  const mode = props.mode
  if (!mode || (mode === 'source' && !sourceSnapshot.value))
    return
  const isSourceText = mode === 'source' || configViewMode.value === 'source'
  const url = URL.createObjectURL(new Blob([exportText()], { type: isSourceText ? 'text/plain' : 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = mode === 'source'
    ? sourceViewPath.value.split('/').at(-1)!
    : configViewMode.value === 'source' ? 'form.config.ts' : 'page.config.json'
  anchor.click()
  URL.revokeObjectURL(url)
  emit('message', mode === 'source'
    ? locale.value.t('export.downloadedSource', 'Downloaded source export')
    : locale.value.t('export.downloadedConfig', 'Downloaded config export'))
}

async function downloadProject(): Promise<void> {
  if (!sourceSnapshot.value)
    return
  try {
    const filename = await downloadWorkspaceArchive({
      name: sourceSnapshot.value.applicationName,
      files: sourceSnapshot.value.files,
    })
    emit('message', locale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }))
  }
  catch (error) {
    emit('message', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div v-if="mode" class="export-preview-overlay" @click.self="emit('close')">
    <section ref="dialog" class="export-preview-dialog" role="dialog" aria-modal="true" :aria-labelledby="`${mode}-export-title`" @keydown="handleKeydown">
      <header>
        <div>
          <span class="dialog-eyebrow">{{ locale.t('export.readOnly', 'Read only export') }}</span>
          <h2 :id="`${mode}-export-title`">{{ mode === 'source' ? locale.t('export.generatedSource', 'Generated Vue source') : locale.t('export.configModel', 'Config model') }}</h2>
        </div>
        <button type="button" :title="locale.t('export.close', 'Close export')" :aria-label="locale.t('export.close', 'Close export')" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
        </button>
      </header>
      <div class="export-preview-body">
        <div v-if="mode === 'source'" class="source-export-view">
          <div v-if="sourceSnapshotError" class="export-diagnostic" role="alert">
            <strong>{{ locale.t('export.sourceUnavailable', 'Source export unavailable') }}</strong>
            <p>{{ sourceSnapshotError }}</p>
          </div>
          <div v-else-if="sourceSnapshotStale" class="export-stale" role="status">
            <span>{{ locale.t('export.staleSource', 'The design changed after this export snapshot was opened.') }}</span>
            <button type="button" @click="refreshSourceSnapshot">
              <RefreshCw :size="14" aria-hidden="true" /> {{ locale.t('export.refresh', 'Refresh snapshot') }}
            </button>
          </div>
          <div class="source-file-layout">
            <nav class="source-file-tabs" role="tablist" :aria-label="locale.t('export.sourceView', 'Source export view')">
              <button type="button" role="tab" :aria-selected="sourceMobileView === 'tree'" @click="sourceMobileView = 'tree'">{{ locale.t('export.tree', 'Tree') }}</button>
              <button type="button" role="tab" :aria-selected="sourceMobileView === 'code'" @click="sourceMobileView = 'code'">{{ locale.t('export.code', 'Code') }}</button>
            </nav>
            <ProjectFileTree
              v-model:expanded-ids="sourceTreeExpandedIds"
              :class="{ 'is-mobile-hidden': sourceMobileView !== 'tree' }"
              :nodes="sourceFileTree"
              :locale="props.locale"
              :selected-path="sourceViewPath"
              @select="selectSourcePath"
            />
            <div class="source-code-pane" :class="{ 'is-mobile-hidden': sourceMobileView !== 'code' }">
              <WorkspaceCodeEditor
                v-if="selectedSourceFile?.kind === 'text'"
                :filename="sourceViewPath"
                :language="sourceLanguage"
                :locale="props.locale"
                :model-value="sourceCode"
                :readonly="true"
                :theme="theme"
              />
              <div v-else-if="selectedSourceFile" class="source-binary-placeholder" role="status">
                <Files :size="24" aria-hidden="true" />
                <strong>{{ sourceViewPath.split('/').at(-1) }}</strong>
                <span>{{ locale.t('export.binaryBytes', '{count} byte binary file', { count: selectedSourceFile.content.byteLength }) }}</span>
              </div>
            </div>
          </div>
        </div>
        <template v-else>
          <div v-if="projectionStale" class="export-stale" role="status">
            <span>{{ locale.t('export.staleConfig', 'The design changed after this config snapshot was opened.') }}</span>
            <button type="button" @click="refreshConfigSnapshot">
              <RefreshCw :size="14" aria-hidden="true" /> {{ locale.t('export.refresh', 'Refresh snapshot') }}
            </button>
          </div>
          <nav class="config-view-tabs" role="tablist" :aria-label="locale.t('export.configView', 'Config view')">
            <button type="button" role="tab" :aria-selected="configViewMode === 'source'" @click="configViewMode = 'source'">{{ locale.t('export.sourceViewTab', 'Source') }}</button>
            <button type="button" role="tab" :aria-selected="configViewMode === 'json'" @click="configViewMode = 'json'">JSON</button>
            <button type="button" role="tab" :aria-selected="configViewMode === 'tree'" @click="configViewMode = 'tree'">{{ locale.t('export.tree', 'Tree') }}</button>
          </nav>
          <WorkspaceCodeEditor
            v-if="configViewMode === 'source'"
            :filename="CONFIG_PATH"
            language="typescript"
            :locale="props.locale"
            :model-value="generatedConfigSource"
            :readonly="true"
            :theme="theme"
          />
          <pre v-if="configViewMode === 'json'" class="config-json-view" tabindex="0">{{ generatedConfigJson }}</pre>
          <div v-else-if="configViewMode === 'tree'" class="config-tree-view" role="tree" tabindex="0">
            <div v-for="entry in generatedConfigTree" :key="entry.path" role="treeitem" :style="{ paddingLeft: `${12 + entry.depth * 18}px` }">
              <span class="config-tree-key">{{ entry.path.split('.').at(-1) }}</span>
              <span class="config-tree-value" :class="{ 'is-branch': entry.branch }">{{ entry.value }}</span>
            </div>
          </div>
        </template>
      </div>
      <footer>
        <span v-if="mode === 'source'">{{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: sourceSnapshot?.modelRevision ?? '-' }) }}{{ sourceSnapshotStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}</span>
        <span v-else>{{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: projection?.modelRevision ?? '-' }) }}{{ projectionStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}</span>
        <div>
          <button v-if="mode === 'source'" type="button" class="dialog-action secondary" :disabled="!sourceSnapshot" @click="downloadProject">
            <Download :size="15" aria-hidden="true" /> {{ locale.t('export.projectZip', 'Project ZIP') }}
          </button>
          <button type="button" class="dialog-action secondary" @click="copyExport">
            <Clipboard :size="15" aria-hidden="true" /> {{ locale.t('action.copy', 'Copy') }}
          </button>
          <button type="button" class="dialog-action" :disabled="mode === 'source' && !sourceSnapshot" @click="downloadCurrent">
            <Download :size="15" aria-hidden="true" /> {{ locale.t('action.download', 'Download') }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
