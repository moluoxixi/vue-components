<script setup lang="ts">
import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type {
  BuildExportSnapshotInput,
  ExportFileSet,
  ExportSessionState,
  ProjectPath,
  WorkspaceFile,
} from '../../project'
import {
  Clipboard,
  Download,
  Files,
  RefreshCw,
  X,
} from '@lucide/vue'
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import ProjectFileTree from '../../components/ProjectFileTree.vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'
import {
  buildProjectFileTree,
  collectProjectTreeDirectoryIds,
  createExportSession,
  downloadWorkspaceArchive,
  normalizeProjectPath,
  resolveExportSnapshotPath,
} from '../../project'

export type ExportMode = 'source' | 'config'
type ConfigViewMode = 'source' | 'json' | 'tree'
type MobileFileView = 'tree' | 'code'

interface ConfigTreeEntry {
  branch: boolean
  depth: number
  label: string
  path: string
  value: string
}

const props = defineProps<{
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation?: ProjectCompilation
  locale?: DesignerLocaleOptions
  mode?: ExportMode
  theme: 'dark' | 'light'
}>()

const emit = defineEmits<{
  close: []
  message: [message: string]
}>()

const WorkspaceCodeEditor = defineAsyncComponent(() => import('../../components/WorkspaceCodeEditor.vue'))
const DEFAULT_SOURCE_PATH = normalizeProjectPath('src/App.vue')
const DEFAULT_CONFIG_PATH = normalizeProjectPath('project.config.ts')
const dialog = useTemplateRef<HTMLElement>('dialog')
const sourceViewPath = ref<ProjectPath>(DEFAULT_SOURCE_PATH)
const configViewPath = ref<ProjectPath>(DEFAULT_CONFIG_PATH)
const sourceTreeExpandedIds = ref<string[]>([])
const configTreeExpandedIds = ref<string[]>([])
const sourceMobileView = ref<MobileFileView>('tree')
const configMobileView = ref<MobileFileView>('tree')
const configViewMode = ref<ConfigViewMode>('source')
const locale = computed(() => createDesignerLocale(props.locale))
const exportSession = createExportSession({
  capture: () => props.capture(),
  currentCompilation: () => props.currentCompilation,
})
const sessionState = shallowRef<ExportSessionState>(exportSession.state)
const unsubscribeSession = exportSession.subscribe(state => sessionState.value = state)
const snapshot = computed(() => sessionState.value.snapshot)
const snapshotEditVersion = computed(() => {
  const origin = snapshot.value?.compilation.origin
  if (!origin)
    return '-'
  return origin.kind === 'committed' ? origin.editVersion : origin.baseEditVersion
})
const snapshotError = computed(() => sessionState.value.error ?? '')
const snapshotStale = computed(() => sessionState.value.stale)
const sourceFileSet = computed(() => snapshot.value?.source)
const configFileSet = computed(() => snapshot.value?.config)
const sourceFileTree = computed(() => sourceFileSet.value ? buildProjectFileTree(sourceFileSet.value.files) : [])
const configFileTree = computed(() => configFileSet.value ? buildProjectFileTree(configFileSet.value.files) : [])
const selectedSourceFile = computed<Readonly<WorkspaceFile> | undefined>(() => sourceFileSet.value?.files[sourceViewPath.value])
const selectedConfigFile = computed<Readonly<WorkspaceFile> | undefined>(() => configFileSet.value?.files[configViewPath.value])
const sourceCode = computed(() => selectedSourceFile.value?.kind === 'text' ? selectedSourceFile.value.content : '')
const configCode = computed(() => selectedConfigFile.value?.kind === 'text' ? selectedConfigFile.value.content : '')
const configDocument = computed(() => snapshot.value?.compilation.snapshot.document)
const generatedConfigJson = computed(() => configDocument.value
  ? `${JSON.stringify(configDocument.value, null, 2)}\n`
  : '')
const { handleKeydown } = useWorkbenchDialogFocus(
  () => !!props.mode,
  dialog,
  () => emit('close'),
)

const generatedConfigTree = computed<ConfigTreeEntry[]>(() => {
  const document = configDocument.value
  if (!document)
    return []
  const entries: ConfigTreeEntry[] = []
  const visit = (value: unknown, path: string, depth: number, label: string): void => {
    const branch = typeof value === 'object' && value !== null
    entries.push({
      branch,
      depth,
      label,
      path,
      value: branch ? (Array.isArray(value) ? `[${value.length}]` : '{...}') : JSON.stringify(value),
    })
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1, `[${index}]`))
      return
    }
    if (branch) {
      Object.entries(value).forEach(([key, child]) => visit(
        child,
        path ? `${path}.${key}` : key,
        depth + 1,
        key,
      ))
    }
  }
  Object.entries(document).forEach(([key, value]) => visit(value, key, 0, key))
  return entries
})

watch(() => props.currentCompilation, () => exportSession.sync())
watch(() => props.mode, (mode) => {
  if (!mode)
    return
  if (mode === 'source')
    sourceMobileView.value = 'tree'
  else {
    configViewMode.value = 'source'
    configMobileView.value = 'tree'
  }
  if (!snapshot.value)
    void refreshSnapshot()
  else
    exportSession.sync()
}, { immediate: true })

onBeforeUnmount(unsubscribeSession)

function languageFor(file: Readonly<WorkspaceFile> | undefined, path: ProjectPath): string {
  if (file?.kind === 'text' && file.language)
    return file.language
  if (path.endsWith('.vue')) return 'vue'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.html')) return 'html'
  return 'typescript'
}

async function refreshSnapshot(): Promise<void> {
  const result = await exportSession.refresh()
  if (!result.success)
    return
  sourceViewPath.value = resolveExportSnapshotPath(result.snapshot.source, sourceViewPath.value)
    ?? result.snapshot.source.entry
  configViewPath.value = resolveExportSnapshotPath(result.snapshot.config, configViewPath.value)
    ?? result.snapshot.config.entry
  sourceTreeExpandedIds.value = collectProjectTreeDirectoryIds(buildProjectFileTree(result.snapshot.source.files))
  configTreeExpandedIds.value = collectProjectTreeDirectoryIds(buildProjectFileTree(result.snapshot.config.files))
}

function selectSourcePath(path: ProjectPath): void {
  sourceViewPath.value = path
  sourceMobileView.value = 'code'
}

function selectConfigPath(path: ProjectPath): void {
  configViewPath.value = path
  configMobileView.value = 'code'
}

function activeFileSet(): ExportFileSet | undefined {
  return props.mode === 'source' ? sourceFileSet.value : configFileSet.value
}

function exportText(): string {
  if (props.mode === 'source')
    return sourceCode.value
  return configViewMode.value === 'source' ? configCode.value : generatedConfigJson.value
}

async function copyExport(): Promise<void> {
  if (!snapshot.value) {
    emit('message', snapshotError.value)
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
  if (!mode || !snapshot.value)
    return
  const isCode = mode === 'source' || configViewMode.value === 'source'
  const url = URL.createObjectURL(new Blob([exportText()], { type: isCode ? 'text/plain' : 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = mode === 'source'
    ? sourceViewPath.value.split('/').at(-1)!
    : configViewMode.value === 'source'
      ? configViewPath.value.split('/').at(-1)!
      : 'project.config.json'
  anchor.click()
  URL.revokeObjectURL(url)
  emit('message', mode === 'source'
    ? locale.value.t('export.downloadedSource', 'Downloaded source export')
    : locale.value.t('export.downloadedConfig', 'Downloaded config export'))
}

async function downloadBundle(): Promise<void> {
  const fileSet = activeFileSet()
  const current = snapshot.value
  if (!fileSet || !current)
    return
  try {
    const suffix = props.mode === 'source' ? 'source' : 'config'
    const filename = await downloadWorkspaceArchive({
      name: `${current.compilation.ir.name}-${suffix}`,
      files: fileSet.files,
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
          <div v-if="snapshotError" class="export-diagnostic" role="alert">
            <strong>{{ locale.t('export.sourceUnavailable', 'Source export unavailable') }}</strong>
            <p>{{ snapshotError }}</p>
          </div>
          <div v-if="snapshotStale" class="export-stale" role="status">
            <span>{{ locale.t('export.staleSource', 'The design changed after this export snapshot was opened.') }}</span>
            <button type="button" @click="refreshSnapshot">
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
                :language="languageFor(selectedSourceFile, sourceViewPath)"
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

        <div v-else class="config-export-view">
          <div v-if="snapshotError" class="export-diagnostic" role="alert">
            <strong>{{ locale.t('export.configUnavailable', 'Config export unavailable') }}</strong>
            <p>{{ snapshotError }}</p>
          </div>
          <div v-if="snapshotStale" class="export-stale" role="status">
            <span>{{ locale.t('export.staleConfig', 'The design changed after this export snapshot was opened.') }}</span>
            <button type="button" @click="refreshSnapshot">
              <RefreshCw :size="14" aria-hidden="true" /> {{ locale.t('export.refresh', 'Refresh snapshot') }}
            </button>
          </div>
          <nav class="config-view-tabs" role="tablist" :aria-label="locale.t('export.configView', 'Config view')">
            <button type="button" role="tab" :aria-selected="configViewMode === 'source'" @click="configViewMode = 'source'">{{ locale.t('export.sourceViewTab', 'Source') }}</button>
            <button type="button" role="tab" :aria-selected="configViewMode === 'json'" @click="configViewMode = 'json'">JSON</button>
            <button type="button" role="tab" :aria-selected="configViewMode === 'tree'" @click="configViewMode = 'tree'">{{ locale.t('export.tree', 'Tree') }}</button>
          </nav>
          <div v-if="configViewMode === 'source'" class="source-file-layout">
            <nav class="source-file-tabs" role="tablist" :aria-label="locale.t('export.configSourceView', 'Config source view')">
              <button type="button" role="tab" :aria-selected="configMobileView === 'tree'" @click="configMobileView = 'tree'">{{ locale.t('export.tree', 'Tree') }}</button>
              <button type="button" role="tab" :aria-selected="configMobileView === 'code'" @click="configMobileView = 'code'">{{ locale.t('export.code', 'Code') }}</button>
            </nav>
            <ProjectFileTree
              v-model:expanded-ids="configTreeExpandedIds"
              :class="{ 'is-mobile-hidden': configMobileView !== 'tree' }"
              :nodes="configFileTree"
              :locale="props.locale"
              :selected-path="configViewPath"
              @select="selectConfigPath"
            />
            <div class="source-code-pane" :class="{ 'is-mobile-hidden': configMobileView !== 'code' }">
              <WorkspaceCodeEditor
                v-if="selectedConfigFile?.kind === 'text'"
                :filename="configViewPath"
                :language="languageFor(selectedConfigFile, configViewPath)"
                :locale="props.locale"
                :model-value="configCode"
                :readonly="true"
                :theme="theme"
              />
            </div>
          </div>
          <pre v-else-if="configViewMode === 'json'" class="config-json-view" tabindex="0">{{ generatedConfigJson }}</pre>
          <div v-else class="config-tree-view" role="tree" tabindex="0">
            <div v-for="entry in generatedConfigTree" :key="entry.path" role="treeitem" :style="{ paddingLeft: `${12 + entry.depth * 18}px` }">
              <span class="config-tree-key">{{ entry.label }}</span>
              <span class="config-tree-value" :class="{ 'is-branch': entry.branch }">{{ entry.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <span>{{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: snapshotEditVersion }) }}{{ snapshotStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}</span>
        <div>
          <button type="button" class="dialog-action secondary" :disabled="!snapshot" @click="downloadBundle">
            <Download :size="15" aria-hidden="true" /> {{ mode === 'source' ? locale.t('export.projectZip', 'Project ZIP') : locale.t('export.configZip', 'Config ZIP') }}
          </button>
          <button type="button" class="dialog-action secondary" :disabled="!snapshot" @click="copyExport">
            <Clipboard :size="15" aria-hidden="true" /> {{ locale.t('action.copy', 'Copy') }}
          </button>
          <button type="button" class="dialog-action" :disabled="!snapshot" @click="downloadCurrent">
            <Download :size="15" aria-hidden="true" /> {{ locale.t('action.download', 'Download') }}
          </button>
        </div>
      </footer>
    </section>
  </div>
</template>
