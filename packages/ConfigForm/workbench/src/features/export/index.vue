<script setup lang="ts">
import type { SourceFile, SourceFileSetV1, SourceStyleTarget } from '@moluoxixi/config-form-source/generator'
import type { BuildExportSnapshotInput, ExportSessionState } from '../../project'
import type { ExportDialogEmits, ExportDialogProps } from './types'
import { Clipboard, Download, RefreshCw, X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  createExportSession,
  downloadSourceArchive,
  downloadSourceFile,
  resolveExportSnapshotPath,
} from '../../project'
import '@moluoxixi/config-form-source/viewer/style'

const props = defineProps<ExportDialogProps>()
const emit = defineEmits<ExportDialogEmits>()

const locale = computed(() => createDesignerLocale(props.locale))
const rawSelectedPath = ref('src/main.ts')
const bindingSelectedPath = ref('src/bindings.ts')
const styleTarget = ref<SourceStyleTarget>('css')
const refreshing = ref(false)
const styleTargetOptions = computed(() => [
  { label: locale.value.t('export.style.css', 'CSS'), value: 'css' },
  { label: locale.value.t('export.style.tailwind', 'Tailwind v4'), value: 'tailwind-v4' },
] satisfies { label: string, value: SourceStyleTarget }[])
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
const unsubscribeSession = exportSession.subscribe(state => sessionState.value = state)
const snapshot = computed(() => sessionState.value.snapshot)
const activeSnapshot = computed(() => snapshot.value?.styleTarget === styleTarget.value
  ? snapshot.value
  : undefined)
const snapshotStale = computed(() => sessionState.value.stale)
const activeArtifact = computed(() => props.mode === 'config'
  ? activeSnapshot.value?.configBindings
  : activeSnapshot.value?.rawSource)
const snapshotError = computed(() => {
  if (sessionState.value.error)
    return sessionState.value.error
  const artifact = activeArtifact.value
  return artifact?.status === 'failed'
    ? artifact.diagnostics.map(item => `${item.code}: ${item.message}`).join('; ')
    : ''
})
const activeFileSet = computed<SourceFileSetV1 | undefined>(() => activeArtifact.value?.status === 'ready'
  ? activeArtifact.value.fileSet
  : undefined)
const selectedPath = computed({
  get: () => props.mode === 'config' ? bindingSelectedPath.value : rawSelectedPath.value,
  set: (path: string) => {
    if (props.mode === 'config')
      bindingSelectedPath.value = path
    else
      rawSelectedPath.value = path
  },
})
const selectedFile = computed<SourceFile | undefined>(() =>
  activeFileSet.value?.files.find(file => file.path === selectedPath.value))
const exportText = computed(() => selectedFile.value?.kind === 'text'
  ? selectedFile.value.content
  : undefined)
const snapshotEditVersion = computed(() => {
  const origin = snapshot.value?.compilation.origin
  if (!origin)
    return '-'
  return origin.kind === 'committed' ? origin.editVersion : origin.baseEditVersion
})
const dialogTitle = computed(() => props.mode === 'config'
  ? locale.value.t('export.configBindings', 'ConfigForm binding source')
  : locale.value.t('export.rawVueSource', 'Raw Vue source'))

watch(() => props.currentCompilation, () => exportSession.sync())
watch(() => props.mode, (mode) => {
  if (!mode)
    return
  if (!snapshot.value)
    void refreshSnapshot()
  else
    exportSession.sync()
}, { immediate: true })

onBeforeUnmount(unsubscribeSession)

async function refreshSnapshot(preservePinnedInput = false): Promise<void> {
  if (refreshing.value)
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
      rawSelectedPath.value = resolveExportSnapshotPath(rawSource, rawSelectedPath.value)
        ?? rawSource.entry
    }
    if (result.snapshot.configBindings.status === 'ready') {
      const configBindings = result.snapshot.configBindings.fileSet
      bindingSelectedPath.value = resolveExportSnapshotPath(configBindings, bindingSelectedPath.value)
        ?? configBindings.entry
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
  const file = selectedFile.value
  if (!file)
    return
  downloadSourceFile({
    file,
    filename: file.path.split('/').at(-1) ?? 'source.txt',
  })
  emit('message', props.mode === 'config'
    ? locale.value.t('export.downloadedBindings', 'Downloaded ConfigForm binding source')
    : locale.value.t('export.downloadedRawSource', 'Downloaded raw Vue source'))
}

async function downloadBundle(): Promise<void> {
  const fileSet = activeFileSet.value
  const current = snapshot.value
  if (!fileSet || !current)
    return
  try {
    const suffix = props.mode === 'config' ? 'config-form-bindings' : 'vue-source'
    const filename = await downloadSourceArchive({
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
      <div class="export-dialog-heading flex min-w-0 items-center justify-between gap-4">
        <div>
          <span class="dialog-eyebrow text-[11px] font-bold tracking-[0.04em] text-wb-accent-text uppercase">{{ locale.t('export.readOnly', 'Read only export') }}</span>
          <h2 class="mt-0.5 mb-0 text-[15px] text-wb-text-strong">{{ dialogTitle }}</h2>
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

    <div
      class="export-preview-body flex min-h-0 min-w-0 w-full flex-auto flex-col overflow-hidden bg-wb-editor-surface"
      :aria-busy="refreshing"
    >
      <div class="export-style-toolbar">
        <span>{{ locale.t('export.style.label', 'Project styling') }}</span>
        <ElSegmented
          class="export-style-target"
          :model-value="styleTarget"
          :options="styleTargetOptions"
          :disabled="refreshing"
          :aria-label="locale.t('export.style.label', 'Project styling')"
          @update:model-value="setStyleTarget"
        />
      </div>
      <ElAlert
        v-if="snapshotError"
        class="export-diagnostic"
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
            class="export-diagnostic-refresh"
            @click="refreshSnapshot()"
          >
            <RefreshCw :size="14" aria-hidden="true" />
            {{ locale.t('export.refresh', 'Refresh snapshot') }}
          </ElButton>
        </template>
      </ElAlert>
      <ElAlert v-if="snapshotStale" class="export-stale" type="warning" :closable="false" show-icon>
        <template #title>
          <span>{{ locale.t('export.staleSource', 'The design changed after this export snapshot was opened.') }}</span>
          <ElButton native-type="button" text @click="refreshSnapshot()">
            <RefreshCw :size="14" aria-hidden="true" />
            {{ locale.t('export.refresh', 'Refresh snapshot') }}
          </ElButton>
        </template>
      </ElAlert>
      <ConfigFormSourceViewer
        v-model:selected-path="selectedPath"
        class="export-source-viewer"
        :files="activeFileSet"
        :theme="theme"
      />
    </div>

    <template #footer>
      <div class="export-dialog-footer flex min-w-0 items-center justify-between gap-4 text-[11px] text-wb-muted">
        <span>
          {{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: snapshotEditVersion }) }}{{ snapshotStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}
        </span>
        <div class="export-dialog-actions flex gap-1.5">
          <ElButton native-type="button" class="dialog-action secondary" :disabled="!activeFileSet" @click="downloadBundle">
            <Download :size="15" aria-hidden="true" />
            {{ locale.t('export.projectZip', 'Project ZIP') }}
          </ElButton>
          <ElButton native-type="button" class="dialog-action secondary" :disabled="exportText === undefined" @click="copyExport">
            <Clipboard :size="15" aria-hidden="true" />
            {{ locale.t('action.copy', 'Copy') }}
          </ElButton>
          <ElButton native-type="button" type="primary" class="dialog-action" :disabled="!selectedFile" @click="downloadCurrent">
            <Download :size="15" aria-hidden="true" />
            {{ locale.t('action.download', 'Download') }}
          </ElButton>
        </div>
      </div>
    </template>
  </ElDialog>
</template>
