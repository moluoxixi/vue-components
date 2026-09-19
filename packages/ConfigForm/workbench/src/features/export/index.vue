<script setup lang="ts">
import type { SourceFile, SourceFileSetV1 } from '@moluoxixi/config-form-source/generator'
import type { ExportSessionState } from '../../project'
import type { ExportDialogEmits, ExportDialogProps } from './types'
import { Clipboard, Download, RefreshCw, X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { ConfigFormSourceViewer } from '@moluoxixi/config-form-source/viewer'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  createExportSession,
  downloadSourceFile,
  downloadWorkspaceArchive,
  resolveExportSnapshotPath,
} from '../../project'
import '@moluoxixi/config-form-source/viewer/style'

const props = defineProps<ExportDialogProps>()
const emit = defineEmits<ExportDialogEmits>()

const locale = computed(() => createDesignerLocale(props.locale))
const rawSelectedPath = ref('src/main.ts')
const bindingSelectedPath = ref('src/bindings.ts')
const exportSession = createExportSession({
  capture: () => props.capture(),
  currentCompilation: () => props.currentCompilation,
})
const sessionState = shallowRef<ExportSessionState>(exportSession.state)
const unsubscribeSession = exportSession.subscribe(state => sessionState.value = state)
const snapshot = computed(() => sessionState.value.snapshot)
const snapshotError = computed(() => sessionState.value.error ?? '')
const snapshotStale = computed(() => sessionState.value.stale)
const activeFileSet = computed<SourceFileSetV1 | undefined>(() => props.mode === 'config'
  ? snapshot.value?.configBindings
  : snapshot.value?.rawSource)
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

async function refreshSnapshot(): Promise<void> {
  const result = await exportSession.refresh()
  if (!result.success)
    return
  rawSelectedPath.value = resolveExportSnapshotPath(result.snapshot.rawSource, rawSelectedPath.value)
    ?? result.snapshot.rawSource.entry
  bindingSelectedPath.value = resolveExportSnapshotPath(
    result.snapshot.configBindings,
    bindingSelectedPath.value,
  ) ?? result.snapshot.configBindings.entry
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
      <div class="export-dialog-footer">
        <span>
          {{ locale.t('export.snapshotRevision', 'Snapshot model revision {revision}', { revision: snapshotEditVersion }) }}{{ snapshotStale ? ` · ${locale.t('export.stale', 'Stale')}` : '' }}
        </span>
        <div>
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
