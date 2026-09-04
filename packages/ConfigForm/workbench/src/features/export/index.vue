<script setup lang="ts">
import type {
  ExportFileSet,
  ExportSessionState,
  ProjectPath,
  WorkspaceFile,
} from '../../project'
import type {
  ConfigJsonScope,
  ConfigTreeEntry,
  ConfigViewMode,
  ExportDialogEmits,
  ExportDialogProps,
  MobileFileView,
} from './types'
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
  watch,
} from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ProjectFileTree } from './components'
import {
  buildProjectFileTree,
  collectProjectTreeDirectoryIds,
  createExportSession,
  downloadWorkspaceFile,
  downloadWorkspaceArchive,
  normalizeProjectPath,
  resolveExportSnapshotPath,
} from '../../project'
import { createPageTransferDocument } from '../../project'

const props = defineProps<ExportDialogProps>()

const emit = defineEmits<ExportDialogEmits>()

const WorkspaceCodeEditor = defineAsyncComponent(() => import('./components/WorkspaceCodeEditor').then(module => module.WorkspaceCodeEditor))
const DEFAULT_SOURCE_PATH = normalizeProjectPath('src/App.vue')
const DEFAULT_CONFIG_PATH = normalizeProjectPath('project.config.ts')
const sourceViewPath = ref<ProjectPath>(DEFAULT_SOURCE_PATH)
const configViewPath = ref<ProjectPath>(DEFAULT_CONFIG_PATH)
const sourceTreeExpandedIds = ref<string[]>([])
const configTreeExpandedIds = ref<string[]>([])
const sourceMobileView = ref<MobileFileView>('tree')
const configMobileView = ref<MobileFileView>('tree')
const configViewMode = ref<ConfigViewMode>('source')
const configJsonScope = ref<ConfigJsonScope>('project')
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
const configJsonValue = computed(() => {
  const document = configDocument.value
  if (!document)
    return undefined
  return configJsonScope.value === 'project'
    ? document
    : createPageTransferDocument(document, props.currentPageId ?? '')
})
const generatedConfigJson = computed(() => configJsonValue.value
  ? `${JSON.stringify(configJsonValue.value, null, 2)}\n`
  : '')
const configScopeOptions = computed(() => [
  { label: locale.value.t('export.scopeProject', 'Entire project'), value: 'project' },
  { label: locale.value.t('export.scopePage', 'Current page'), value: 'page', disabled: !props.currentPageId || !configDocument.value?.pagesById[props.currentPageId] },
])
const dialogTitle = computed(() => props.mode === 'source'
  ? locale.value.t('export.generatedSource', 'Generated Vue source')
  : locale.value.t('export.configModel', 'Config model'))

const generatedConfigTree = computed<ConfigTreeEntry[]>(() => {
  const value = configJsonValue.value
  if (!value)
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
  Object.entries(value).forEach(([key, child]) => visit(child, key, 0, key))
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

const exportText = computed<string | undefined>(() => {
  if (props.mode === 'source')
    return selectedSourceFile.value?.kind === 'text' ? selectedSourceFile.value.content : undefined
  if (configViewMode.value === 'source')
    return selectedConfigFile.value?.kind === 'text' ? selectedConfigFile.value.content : undefined
  return configJsonValue.value ? generatedConfigJson.value : undefined
})

async function copyExport(): Promise<void> {
  if (!snapshot.value) {
    emit('message', snapshotError.value)
    return
  }
  try {
    if (!navigator.clipboard)
      throw new Error(locale.value.t('export.clipboardUnavailable', 'Clipboard API is unavailable.'))
    if (exportText.value === undefined)
      throw new Error(locale.value.t('export.binaryCopyUnavailable', 'Binary files cannot be copied as text.'))
    await navigator.clipboard.writeText(exportText.value)
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
  const file = mode === 'source'
    ? selectedSourceFile.value
    : configViewMode.value === 'source'
      ? selectedConfigFile.value
      : configJsonValue.value
        ? { content: generatedConfigJson.value, kind: 'text' as const, language: 'json' }
        : undefined
  if (!file)
    return
  downloadWorkspaceFile({
    file,
    filename: mode === 'source'
      ? sourceViewPath.value.split('/').at(-1)!
      : configViewMode.value === 'source'
        ? configViewPath.value.split('/').at(-1)!
        : configJsonScope.value === 'page'
          ? `${(props.currentPageId ?? 'page').replace(/[^a-z0-9._-]+/gi, '-')}.page.json`
          : 'project.config.json',
    ...(mode === 'config' && configViewMode.value !== 'source'
      ? { mime: 'application/json;charset=utf-8' }
      : {}),
  })
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
  <ElDialog
    class="export-preview-dialog"
    :model-value="!!mode"
    :title="dialogTitle"
    width="min(1120px, calc(100vw - 40px))"
    append-to="#workbench-overlays"
    transition="none"
    :show-close="false"
    @close="emit('close')"
  >
    <template #header>
      <div class="export-dialog-heading">
        <div>
          <span class="dialog-eyebrow">{{ locale.t('export.readOnly', 'Read only export') }}</span>
          <h2>{{ dialogTitle }}</h2>
        </div>
        <ElButton
          native-type="button"
          text
          :title="locale.t('export.close', 'Close export')"
          :aria-label="locale.t('export.close', 'Close export')"
          @click="emit('close')"
        >
          <X :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </template>

    <div class="export-preview-body">
        <div v-if="mode === 'source'" class="source-export-view">
          <ElAlert
            v-if="snapshotError"
            class="export-diagnostic"
            type="error"
            :title="locale.t('export.sourceUnavailable', 'Source export unavailable')"
            :description="snapshotError"
            :closable="false"
            show-icon
          />
          <ElAlert v-if="snapshotStale" class="export-stale" type="warning" :closable="false" show-icon>
            <template #title>
              <span>{{ locale.t('export.staleSource', 'The design changed after this export snapshot was opened.') }}</span>
              <ElButton native-type="button" text @click="refreshSnapshot">
                <RefreshCw :size="14" aria-hidden="true" /> {{ locale.t('export.refresh', 'Refresh snapshot') }}
              </ElButton>
            </template>
          </ElAlert>
          <div class="source-file-layout">
            <ElTabs v-model="sourceMobileView" class="source-file-tabs" :aria-label="locale.t('export.sourceView', 'Source export view')">
              <ElTabPane :label="locale.t('export.tree', 'Tree')" name="tree" />
              <ElTabPane :label="locale.t('export.code', 'Code')" name="code" />
            </ElTabs>
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
          <ElAlert
            v-if="snapshotError"
            class="export-diagnostic"
            type="error"
            :title="locale.t('export.configUnavailable', 'Config export unavailable')"
            :description="snapshotError"
            :closable="false"
            show-icon
          />
          <ElAlert v-if="snapshotStale" class="export-stale" type="warning" :closable="false" show-icon>
            <template #title>
              <span>{{ locale.t('export.staleConfig', 'The design changed after this export snapshot was opened.') }}</span>
              <ElButton native-type="button" text @click="refreshSnapshot">
                <RefreshCw :size="14" aria-hidden="true" /> {{ locale.t('export.refresh', 'Refresh snapshot') }}
              </ElButton>
            </template>
          </ElAlert>
          <ElTabs v-model="configViewMode" class="config-view-tabs" :aria-label="locale.t('export.configView', 'Config view')">
            <ElTabPane :label="locale.t('export.sourceViewTab', 'Source')" name="source" />
            <ElTabPane label="JSON" name="json" />
            <ElTabPane :label="locale.t('export.tree', 'Tree')" name="tree" />
          </ElTabs>
          <div v-if="configViewMode !== 'source'" class="config-json-scope">
            <span>{{ locale.t('export.scope', 'JSON scope') }}</span>
            <ElSegmented
              v-model="configJsonScope"
              :aria-label="locale.t('export.scope', 'JSON scope')"
              :options="configScopeOptions"
            />
          </div>
          <div v-if="configViewMode === 'source'" class="source-file-layout">
            <ElTabs v-model="configMobileView" class="source-file-tabs" :aria-label="locale.t('export.configSourceView', 'Config source view')">
              <ElTabPane :label="locale.t('export.tree', 'Tree')" name="tree" />
              <ElTabPane :label="locale.t('export.code', 'Code')" name="code" />
            </ElTabs>
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
          <p v-else-if="!configJsonValue" class="config-json-view" role="status">{{ locale.t('export.currentPageUnavailable', 'The current page is unavailable in this export snapshot.') }}</p>
          <pre v-else-if="configViewMode === 'json'" class="config-json-view" tabindex="0">{{ generatedConfigJson }}</pre>
          <div v-else class="config-tree-view" role="tree" tabindex="0">
            <div v-for="entry in generatedConfigTree" :key="entry.path" role="treeitem" :style="{ paddingLeft: `${12 + entry.depth * 18}px` }">
              <span class="config-tree-key">{{ entry.label }}</span>
              <span class="config-tree-value" :class="{ 'is-branch': entry.branch }">{{ entry.value }}</span>
            </div>
          </div>
        </div>
    </div>

    <template #footer>
      <div class="export-dialog-footer">
        <span>{{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: snapshotEditVersion }) }}{{ snapshotStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}</span>
        <div>
          <ElButton native-type="button" class="dialog-action secondary" :disabled="!snapshot" @click="downloadBundle">
            <Download :size="15" aria-hidden="true" /> {{ mode === 'source' ? locale.t('export.projectZip', 'Project ZIP') : locale.t('export.configZip', 'Config ZIP') }}
          </ElButton>
          <ElButton native-type="button" class="dialog-action secondary" :disabled="!snapshot || exportText === undefined" @click="copyExport">
            <Clipboard :size="15" aria-hidden="true" /> {{ locale.t('action.copy', 'Copy') }}
          </ElButton>
          <ElButton native-type="button" type="primary" class="dialog-action" :disabled="!snapshot || exportText === undefined" @click="downloadCurrent">
            <Download :size="15" aria-hidden="true" /> {{ locale.t('action.download', 'Download') }}
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>
