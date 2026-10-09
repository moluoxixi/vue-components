<script setup lang="ts">
import type { SourceFile, SourceFileSetV1, SourceStyleTarget } from '@moluoxixi/config-form-source/generator'
import type { BuildExportSnapshotInput, ExportSessionState, StructuredSourceArchiveInput } from '../../project'
import type { SourceWorkspaceEmits, SourceWorkspaceProps } from './types'
import {
  Braces,
  ChevronDown,
  CircleCheck,
  Clipboard,
  Code2,
  Download,
  FileJson2,
  FolderTree,
  Layers,
  LockKeyhole,
  RefreshCw,
  Wind,
  WrapText,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  createExportSession,
  downloadProjectTransfer,
  downloadSourceFile,
  downloadStructuredSourceArchive,
  downloadSurfaceTransfer,
  resolveExportSnapshotPath,
} from '../../project'
import {
  projectStructuredSourceFiles,
  projectStructuredSourcePath,
  sourceSurfaceDirectory,
} from '../../project/export'
import { createSourceWorkspaceArchiveInput } from './services'
import '@moluoxixi/config-form-source/viewer/style'

const props = defineProps<SourceWorkspaceProps>()
const emit = defineEmits<SourceWorkspaceEmits>()

const locale = computed(() => createDesignerLocale(props.locale))
const rawSelectedPath = ref('')
const bindingSelectedPath = ref('src/bindings.ts')
const styleTarget = ref<SourceStyleTarget>('tailwind-v4')
const refreshing = ref(false)
const downloading = ref(false)
const copying = ref(false)
const wrapLines = ref(true)
const actionsBusy = computed(() => refreshing.value || downloading.value || copying.value)
const styleTargetOptions = computed(
  () =>
    [
      { label: locale.value.t('export.style.css', 'CSS'), value: 'css' },
      { label: locale.value.t('export.style.tailwind', 'Tailwind v4'), value: 'tailwind-v4' },
    ] satisfies { label: string, value: SourceStyleTarget }[],
)
let pinnedInput: BuildExportSnapshotInput | undefined
let captureOverride: BuildExportSnapshotInput | undefined
let lastCapturedInput: BuildExportSnapshotInput | undefined
const exportSession = createExportSession({
  capture: () => {
    const input = captureOverride ?? props.capture()
    lastCapturedInput = input
    return input ? { ...input, styleTarget: styleTarget.value } : undefined
  },
  currentCompilation: () => props.currentCompilation,
})
const sessionState = shallowRef<ExportSessionState>(exportSession.state)
const unsubscribeSession = exportSession.subscribe(state => (sessionState.value = state))
const snapshot = computed(() => sessionState.value.snapshot)
watch(
  sessionState,
  (state) => {
    const artifacts = state.snapshot ? [state.snapshot.rawSource, state.snapshot.configBindings] : []
    emit('diagnostics', [
      ...artifacts.flatMap(artifact => (artifact.status === 'failed' ? artifact.diagnostics : [])),
      ...(state.error ? [{ code: 'EXPORT_FAILED', message: state.error }] : []),
    ])
  },
  { immediate: true },
)
const activeSnapshot = computed(() => (snapshot.value?.styleTarget === styleTarget.value ? snapshot.value : undefined))
const snapshotStale = computed(() => sessionState.value.stale)
const activeArtifact = computed(() =>
  props.mode === 'config' ? activeSnapshot.value?.configBindings : activeSnapshot.value?.rawSource,
)
const snapshotError = computed(() => {
  if (sessionState.value.error)
    return sessionState.value.error
  const artifact = activeArtifact.value
  return artifact?.status === 'failed'
    ? artifact.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ')
    : ''
})
const activeFileSet = computed<SourceFileSetV1 | undefined>(() =>
  activeArtifact.value?.status === 'ready' ? activeArtifact.value.fileSet : undefined,
)
const structuredFileSet = computed<SourceFileSetV1 | undefined>(() => {
  const fileSet = activeFileSet.value
  const current = snapshot.value
  if (!fileSet || !current)
    return undefined
  const suffix = props.mode === 'config' ? 'config-form-bindings' : 'vue-source'
  const input: StructuredSourceArchiveInput = {
    name: `${current.compilation.ir.name}-${suffix}`,
    projectName: current.compilation.ir.name,
    projectId: current.compilation.key.projectId,
    scope: 'project',
    files: fileSet.files,
  }
  return {
    version: 1,
    kind: fileSet.kind,
    entry: projectStructuredSourcePath(fileSet.entry),
    files: projectStructuredSourceFiles(input),
  }
})
const projectName = computed(() => snapshot.value?.compilation.ir.name ?? '')
const generatedFileCount = computed(() => structuredFileSet.value?.files.length ?? 0)
const selectedPath = computed({
  get: () => (props.mode === 'config' ? bindingSelectedPath.value : rawSelectedPath.value),
  set: (path: string) => {
    if (props.mode === 'config')
      bindingSelectedPath.value = path
    else rawSelectedPath.value = path
  },
})
const selectedFile = computed<SourceFile | undefined>(() =>
  structuredFileSet.value?.files.find(file => file.path === selectedPath.value),
)
const exportText = computed(() => (selectedFile.value?.kind === 'text' ? selectedFile.value.content : undefined))
const selectedLineCount = computed(() => exportText.value?.trimEnd().split('\n').length ?? 0)

function resolveStructuredSelection(fileSet: SourceFileSetV1, preferred: string): string {
  const directory
    = props.surfaceId && snapshot.value
      ? sourceSurfaceDirectory(fileSet.files, props.surfaceId, snapshot.value.compilation.ir.surfaceOrder)
      : undefined
  const pagePath = directory ? `src/surfaces/${directory}/Surface.vue` : undefined
  const sourcePreferred
    = fileSet.files.find(file => projectStructuredSourcePath(file.path) === preferred)?.path ?? pagePath
  const resolved = resolveExportSnapshotPath(fileSet, sourcePreferred) ?? fileSet.entry
  return projectStructuredSourcePath(resolved)
}

const snapshotEditVersion = computed(() => {
  const origin = snapshot.value?.compilation.origin
  if (!origin)
    return '-'
  return origin.kind === 'committed' ? origin.editVersion : origin.baseEditVersion
})
const workspaceTitle = computed(() =>
  props.mode === 'config'
    ? locale.value.t('export.configBindings', 'ConfigForm binding source')
    : locale.value.t('export.rawVueSource', 'Raw Vue source'),
)

async function chooseDownload(command: string): Promise<void> {
  if (command === 'surface-source') {
    await downloadBundle('surface')
    return
  }
  const current = snapshot.value
  const reader = pinnedInput?.resourceReader
  if (actionsBusy.value || !current || !reader || (command !== 'surface-json' && command !== 'project-json'))
    return
  downloading.value = true
  try {
    const readEmbedded = async (request: Parameters<typeof reader.readEmbedded>[0]) => {
      const result = await reader.readEmbedded(request)
      return result.success ? result.data : undefined
    }
    const input = { document: current.compilation.snapshot.document, readEmbedded }
    if (command === 'surface-json' && !props.surfaceId)
      return
    const filename
      = command === 'project-json'
        ? await downloadProjectTransfer(input)
        : await downloadSurfaceTransfer({ ...input, surfaceId: props.surfaceId! })
    emit('notice', {
      message: locale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }),
      tone: 'success',
    })
  }
  catch (error) {
    emit('notice', { message: error instanceof Error ? error.message : String(error), tone: 'error' })
  }
  finally {
    downloading.value = false
  }
}

watch(
  () => props.currentCompilation,
  () => exportSession.sync(),
)
watch(
  () => props.mode,
  (mode) => {
    if (!mode)
      return
    if (!snapshot.value)
      void refreshSnapshot()
    else exportSession.sync()
  },
  { immediate: true },
)

onBeforeUnmount(unsubscribeSession)

async function refreshSnapshot(preservePinnedInput = false): Promise<void> {
  if (actionsBusy.value)
    return
  refreshing.value = true
  captureOverride = preservePinnedInput ? pinnedInput : undefined
  lastCapturedInput = undefined
  try {
    const result = await exportSession.refresh()
    if (!result.success)
      return
    if (lastCapturedInput)
      pinnedInput = lastCapturedInput
    if (result.snapshot.rawSource.status === 'ready') {
      const rawSource = result.snapshot.rawSource.fileSet
      rawSelectedPath.value = resolveStructuredSelection(rawSource, rawSelectedPath.value)
    }
    if (result.snapshot.configBindings.status === 'ready') {
      const configBindings = result.snapshot.configBindings.fileSet
      bindingSelectedPath.value = resolveStructuredSelection(configBindings, bindingSelectedPath.value)
    }
  }
  finally {
    captureOverride = undefined
    refreshing.value = false
  }
}

function setStyleTarget(value: unknown): void {
  if ((value !== 'css' && value !== 'tailwind-v4') || value === styleTarget.value)
    return
  styleTarget.value = value
  void refreshSnapshot(true)
}

async function copyExport(): Promise<void> {
  if (actionsBusy.value)
    return
  copying.value = true
  try {
    if (!navigator.clipboard)
      throw new Error(locale.value.t('export.clipboardUnavailable', 'Clipboard API is unavailable.'))
    if (exportText.value === undefined)
      throw new Error(locale.value.t('export.binaryCopyUnavailable', 'Binary files cannot be copied as text.'))
    await navigator.clipboard.writeText(exportText.value)
    emit('notice', { message: locale.value.t('export.copied', 'Copied export to clipboard'), tone: 'success' })
  }
  catch (error) {
    emit('notice', {
      message: error instanceof Error ? error.message : locale.value.t('export.unableCopy', 'Unable to copy export.'),
      tone: 'error',
    })
  }
  finally {
    copying.value = false
  }
}

function downloadCurrent(): void {
  if (actionsBusy.value)
    return
  const file = selectedFile.value
  if (!file)
    return
  downloadSourceFile({
    file,
    filename: file.path.split('/').at(-1) ?? 'source.txt',
  })
  emit('notice', {
    message:
      props.mode === 'config'
        ? locale.value.t('export.downloadedBindings', 'Downloaded ConfigForm binding source')
        : locale.value.t('export.downloadedRawSource', 'Downloaded raw Vue source'),
    tone: 'success',
  })
}

async function downloadBundle(scope: 'project' | 'surface' = 'project'): Promise<void> {
  if (actionsBusy.value)
    return
  const fileSet = activeFileSet.value
  const current = snapshot.value
  const captured = pinnedInput
  if (!fileSet || !current || !captured || !props.mode)
    return
  downloading.value = true
  try {
    const archiveInput = await createSourceWorkspaceArchiveInput({
      captured,
      snapshot: current,
      mode: props.mode,
      scope,
      surfaceId: props.surfaceId,
    })
    const filename = await downloadStructuredSourceArchive(archiveInput)
    emit('notice', {
      message: locale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }),
      tone: 'success',
    })
  }
  catch (error) {
    emit('notice', { message: error instanceof Error ? error.message : String(error), tone: 'error' })
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <section v-if="mode" class="source-workspace" :data-mode="mode">
    <header class="source-workspace__heading flex min-w-0 items-center justify-between gap-4">
      <div class="source-workspace__identity">
        <span class="source-workspace__mark text-wb-accent-text"><Code2 :size="20" aria-hidden="true" /></span>
        <div class="source-workspace__heading-copy">
          <h2 class="m-0 text-[16px] text-wb-text-strong">
            {{ workspaceTitle }}
          </h2>
          <span class="source-workspace__project" :title="projectName">
            <FolderTree :size="12" aria-hidden="true" />
            <span>{{ projectName || locale.t('projects.untitled', 'Untitled project') }}</span>
            <span class="source-workspace__file-count">{{
              locale.t('export.fileCount', '{count} files', { count: generatedFileCount })
            }}</span>
          </span>
        </div>
      </div>
      <div class="source-workspace__commands">
        <ElTooltip
          :content="locale.t('export.refresh', 'Refresh snapshot')"
          :trigger="['hover', 'focus']"
          :show-after="350"
          :hide-after="0"
          :enterable="false"
          :persistent="false"
          placement="bottom"
          append-to="#workbench-overlays"
        >
          <ElButton
            native-type="button"
            text
            class="source-workspace__refresh"
            :class="{ 'is-refreshing': refreshing }"
            :disabled="actionsBusy"
            :aria-label="locale.t('export.refresh', 'Refresh snapshot')"
            @click="refreshSnapshot()"
          >
            <RefreshCw :size="16" aria-hidden="true" />
          </ElButton>
        </ElTooltip>
        <div class="source-workspace__download">
          <ElButton
            native-type="button"
            type="primary"
            class="source-workspace__download-project"
            :disabled="!activeFileSet || actionsBusy"
            :loading="downloading"
            @click="downloadBundle()"
          >
            <Download :size="15" aria-hidden="true" />
            {{ locale.t('export.projectZip', 'Download project') }}
          </ElButton>
          <ElDropdown
            trigger="click"
            placement="bottom-end"
            :disabled="actionsBusy"
            append-to="#workbench-overlays"
            @command="chooseDownload"
          >
            <ElButton
              native-type="button"
              type="primary"
              class="source-workspace__download-options"
              :disabled="actionsBusy"
              :title="locale.t('export.downloadOptions', 'Download options')"
              :aria-label="locale.t('export.downloadOptions', 'Download options')"
            >
              <ChevronDown :size="14" aria-hidden="true" />
            </ElButton>
            <template #dropdown>
              <ElDropdownMenu class="source-export-menu">
                <ElDropdownItem command="surface-source" :disabled="!activeFileSet || !surfaceId">
                  <Code2 :size="15" aria-hidden="true" />{{ locale.t('export.surfaceSource', 'Page source') }}
                </ElDropdownItem>
                <ElDropdownItem command="surface-json" :disabled="!snapshot || !surfaceId">
                  <FileJson2 :size="15" aria-hidden="true" />{{ locale.t('export.surfaceJson', 'Page JSON') }}
                </ElDropdownItem>
                <ElDropdownItem command="project-json" :disabled="!snapshot" divided>
                  <Layers :size="15" aria-hidden="true" />{{ locale.t('export.projectJson', 'Project JSON') }}
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </div>
    </header>

    <div class="source-workspace__toolbar" role="toolbar" :aria-label="locale.t('export.sourceShape', 'Source shape')">
      <ElSegmented
        class="source-workspace__mode"
        :model-value="mode"
        :options="[
          { label: locale.t('export.vueMode', 'Vue source'), value: 'source' },
          { label: locale.t('export.bindingsMode', 'ConfigForm bindings'), value: 'config' },
        ]"
        :disabled="actionsBusy"
        @update:model-value="(value) => (value === 'source' || value === 'config') && emit('update:mode', value)"
      >
        <template #default="{ item }">
          <span class="source-workspace__mode-label">
            <component :is="item.value === 'source' ? Code2 : Braces" :size="14" aria-hidden="true" />
            {{ item.label }}
          </span>
        </template>
      </ElSegmented>
      <div class="source-workspace__style">
        <Wind :size="14" aria-hidden="true" />
        <ElSegmented
          class="source-workspace__style-target"
          :model-value="styleTarget"
          :options="styleTargetOptions"
          :disabled="actionsBusy"
          :aria-label="locale.t('export.style.label', 'Project styling')"
          @update:model-value="setStyleTarget"
        />
      </div>
    </div>

    <div
      class="source-workspace__body relative flex min-h-0 min-w-0 w-full flex-auto flex-col overflow-hidden bg-wb-editor-surface"
      :aria-busy="refreshing"
    >
      <ElAlert
        v-if="snapshotError"
        class="source-workspace__diagnostic"
        type="error"
        :description="snapshotError"
        :closable="false"
        show-icon
      >
        <template #title>
          <span>{{ locale.t('export.sourceUnavailable', 'Source export unavailable') }}</span>
          <ElButton
            native-type="button"
            text
            class="source-workspace__retry"
            :disabled="actionsBusy"
            @click="refreshSnapshot()"
          >
            <RefreshCw :size="14" aria-hidden="true" />
            {{ locale.t('export.refresh', 'Refresh snapshot') }}
          </ElButton>
        </template>
      </ElAlert>
      <ElAlert v-if="snapshotStale" class="source-workspace__stale" type="warning" :closable="false" show-icon>
        <template #title>
          <span>{{ locale.t('export.staleSource', 'The design changed after this export snapshot was opened.') }}</span>
          <ElButton native-type="button" text :disabled="actionsBusy" @click="refreshSnapshot()">
            <RefreshCw :size="14" aria-hidden="true" />
            {{ locale.t('export.refresh', 'Refresh snapshot') }}
          </ElButton>
        </template>
      </ElAlert>
      <div v-if="refreshing" class="source-workspace__loading" role="status" aria-live="polite">
        <RefreshCw :size="20" aria-hidden="true" />
        <span>{{ locale.t('export.refreshing', 'Refreshing generated source...') }}</span>
      </div>
      <ConfigFormSourceViewer
        v-model:selected-path="selectedPath"
        class="source-workspace__viewer"
        :files="structuredFileSet"
        :theme="theme"
        :wrap-lines="wrapLines"
        :labels="{
          files: locale.t('export.files', 'Files'),
          code: locale.t('workbench.code', 'Code'),
          openFiles: locale.t('export.openFiles', 'Open files'),
          closeFile: locale.t('action.close', 'Close'),
        }"
      >
        <template #file-actions>
          <div class="source-workspace__file-actions">
            <ElTooltip
              :content="locale.t('export.wrapLines', 'Wrap long lines')"
              :trigger="['hover', 'focus']"
              :show-after="350"
              :hide-after="0"
              :enterable="false"
              :persistent="false"
              placement="bottom"
              append-to="#workbench-overlays"
            >
              <ElButton
                native-type="button"
                text
                class="source-workspace__file-action"
                :aria-pressed="wrapLines"
                :aria-label="locale.t('export.wrapLines', 'Wrap long lines')"
                @click="wrapLines = !wrapLines"
              >
                <WrapText :size="15" aria-hidden="true" />
              </ElButton>
            </ElTooltip>
            <ElTooltip
              :content="locale.t('action.copy', 'Copy')"
              :trigger="['hover', 'focus']"
              :show-after="350"
              :hide-after="0"
              :enterable="false"
              :persistent="false"
              placement="bottom"
              append-to="#workbench-overlays"
            >
              <ElButton
                native-type="button"
                text
                class="source-workspace__file-action"
                :aria-label="locale.t('action.copy', 'Copy')"
                :disabled="exportText === undefined || actionsBusy"
                :loading="copying"
                @click="copyExport"
              >
                <Clipboard :size="15" aria-hidden="true" />
              </ElButton>
            </ElTooltip>
            <ElTooltip
              :content="locale.t('action.download', 'Download')"
              :trigger="['hover', 'focus']"
              :show-after="350"
              :hide-after="0"
              :enterable="false"
              :persistent="false"
              placement="bottom"
              append-to="#workbench-overlays"
            >
              <ElButton
                native-type="button"
                text
                class="source-workspace__file-action"
                :aria-label="locale.t('action.download', 'Download')"
                :disabled="!selectedFile || actionsBusy"
                @click="downloadCurrent"
              >
                <Download :size="15" aria-hidden="true" />
              </ElButton>
            </ElTooltip>
          </div>
        </template>
      </ConfigFormSourceViewer>
    </div>

    <footer
      class="source-workspace__statusbar flex min-w-0 items-center justify-between gap-4 text-[11px] text-wb-muted"
    >
      <span class="source-workspace__status" :class="{ 'is-stale': snapshotStale, 'is-error': snapshotError }">
        <component :is="snapshotError || snapshotStale ? RefreshCw : CircleCheck" :size="12" aria-hidden="true" />
        <span>{{
          snapshotError
            ? locale.t('export.sourceUnavailable', 'Source export unavailable')
            : snapshotStale
              ? locale.t('export.stale', 'Stale')
              : locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', {
                revision: snapshotEditVersion,
              })
        }}</span>
      </span>
      <span class="source-workspace__file-meta">
        <span v-if="selectedLineCount">{{
          locale.t('export.lineCount', '{count} lines', { count: selectedLineCount })
        }}</span>
        <span>UTF-8</span>
        <span class="source-workspace__readonly"><LockKeyhole :size="10" aria-hidden="true" />{{ locale.t('export.readOnly', 'Read only') }}</span>
      </span>
    </footer>
  </section>
</template>
