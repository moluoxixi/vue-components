<script setup lang="ts">
import type { UploadFile, UploadInstance } from 'element-plus'
import type {
  ConfigImportDiagnostic,
  PreparedConfigImport,
} from '../../../../project'
import type { PreviewRuntimeStateEvent } from '../../../../session'
import type { JsonImportPaneEmits, JsonImportPaneProps } from '../../../../features/templates'
import {
  CheckCircle2,
  FileJson2,
  RotateCcw,
  SearchCheck,
  Trash2,
  Upload,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useWorkbenchController, useWorkbenchUiStore } from '../../../composables'
import { MAX_IMPORT_SOURCE_BYTES } from '../../../../project'
import PreviewRuntimeHostFrame from '../../PreviewRuntimeHostFrame/index.vue'

const props = defineProps<JsonImportPaneProps>()
const emit = defineEmits<JsonImportPaneEmits>()

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const locale = computed(() => createDesignerLocale(props.locale))
const sourceInput = useTemplateRef<{ focus?: () => void }>('sourceInput')
const upload = useTemplateRef<UploadInstance>('upload')
const uploadPanel = useTemplateRef<HTMLElement>('uploadPanel')
const sourceMode = ref<'file' | 'paste'>('paste')
const mobileStage = ref<'diagnostics' | 'preview' | 'source'>('source')
const source = ref('')
const selectedFilename = ref('')
const selectedFileSize = ref(0)
const analyzing = ref(false)
const submitting = ref(false)
const diagnostics = shallowRef<ConfigImportDiagnostic[]>([])
const prepared = shallowRef<PreparedConfigImport>()
let requestSequence = 0
let disposed = false

const sourceModeOptions = computed(() => [
  { label: locale.value.t('import.paste', 'Paste'), value: 'paste' },
  { label: locale.value.t('import.file', 'JSON file'), value: 'file' },
])
const ready = computed(() => Boolean(source.value.trim()) && !analyzing.value && !submitting.value)
const hasErrors = computed(() => diagnostics.value.length > 0)
const createLabel = computed(() => props.target === 'project'
  ? locale.value.t('import.createProject', 'Create imported project')
  : locale.value.t('import.createPage', 'Create imported page'))
const targetLabel = computed(() => props.target === 'project'
  ? locale.value.t('import.targetProject', 'Project')
  : locale.value.t('import.targetPage', 'Page'))

function projectIdentity(): string {
  const project = controller.currentProject.value
  return project ? `${project.id}:${getConfigFormJsonSemanticHash(project)}` : ''
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function diagnosticMessage(item: ConfigImportDiagnostic): string {
  return locale.value.t(`import.diagnostic.${item.code}`, item.message)
}

async function focusSource(): Promise<void> {
  await nextTick()
  if (sourceMode.value === 'paste')
    sourceInput.value?.focus?.()
  else
    uploadPanel.value?.querySelector<HTMLElement>('.el-upload')?.focus()
}

function resetAnalysis(focus = false): void {
  requestSequence += 1
  analyzing.value = false
  diagnostics.value = []
  prepared.value = undefined
  mobileStage.value = 'source'
  if (focus)
    void focusSource()
}

function clearSource(): void {
  source.value = ''
  selectedFilename.value = ''
  selectedFileSize.value = 0
  upload.value?.clearFiles()
  resetAnalysis(true)
}

async function readFile(file: File): Promise<void> {
  const request = ++requestSequence
  diagnostics.value = []
  prepared.value = undefined
  selectedFilename.value = file.name
  selectedFileSize.value = file.size
  source.value = ''
  if (file.size > MAX_IMPORT_SOURCE_BYTES) {
    diagnostics.value = [{
      code: 'IMPORT_SOURCE_TOO_LARGE',
      message: locale.value.t('import.fileTooLarge', 'JSON file is {size}; the limit is {limit}.', {
        limit: formatBytes(MAX_IMPORT_SOURCE_BYTES),
        size: formatBytes(file.size),
      }),
      path: '$',
    }]
    mobileStage.value = 'diagnostics'
    return
  }
  let text: string
  try {
    text = await file.text()
  }
  catch {
    if (disposed || request !== requestSequence)
      return
    diagnostics.value = [{
      code: 'IMPORT_FILE_READ_FAILED',
      message: locale.value.t('import.fileReadFailed', 'The JSON file could not be read.'),
      path: '$',
    }]
    mobileStage.value = 'diagnostics'
    return
  }
  if (disposed || request !== requestSequence)
    return
  source.value = text
}

async function handleFileChange(uploadFile: UploadFile): Promise<void> {
  if (uploadFile.raw)
    await readFile(uploadFile.raw)
}

function replaceFile(files: File[]): void {
  upload.value?.clearFiles()
  const file = files[0]
  if (file)
    void readFile(file)
}

async function analyze(): Promise<void> {
  if (!ready.value)
    return
  const request = ++requestSequence
  const target = props.target
  const identity = projectIdentity()
  analyzing.value = true
  diagnostics.value = []
  prepared.value = undefined
  ui.clearMessage()
  try {
    const result = await controller.prepareJsonImport(source.value, target)
    if (
      disposed
      || request !== requestSequence
      || props.target !== target
      || projectIdentity() !== identity
    ) {
      return
    }
    if (!result.success) {
      diagnostics.value = result.diagnostics
      mobileStage.value = 'diagnostics'
      return
    }
    prepared.value = result.prepared
    mobileStage.value = 'diagnostics'
  }
  finally {
    if (!disposed && request === requestSequence)
      analyzing.value = false
  }
}

async function createImported(): Promise<void> {
  const candidate = prepared.value
  if (!candidate || submitting.value || controller.busy.value)
    return
  submitting.value = true
  ui.clearMessage()
  try {
    if (await controller.createFromJsonImport(candidate))
      emit('created')
  }
  finally {
    submitting.value = false
  }
}

function handleRuntimeState(event: PreviewRuntimeStateEvent): void {
  const candidate = prepared.value
  if (!candidate || event.revision !== candidate.preview.revision)
    return
  prepared.value = {
    ...candidate,
    preview: {
      ...candidate.preview,
      runtimeState: structuredClone(event.state),
    },
  }
}

function handleFieldChange(payload: { values: Record<string, unknown> }): void {
  const candidate = prepared.value
  if (!candidate)
    return
  prepared.value = {
    ...candidate,
    preview: {
      ...candidate.preview,
      runtimeState: {
        ...candidate.preview.runtimeState,
        values: structuredClone(payload.values),
      },
    },
  }
}

watch(() => props.target, () => resetAnalysis(false))
watch(sourceMode, () => clearSource())

onMounted(() => void focusSource())

onBeforeUnmount(() => {
  disposed = true
  requestSequence += 1
})
</script>

<template>
  <section class="json-import-pane" :aria-label="locale.t('import.title', 'JSON import')">
    <nav class="json-import-stage-nav" :aria-label="locale.t('import.stages', 'Import stages')">
      <button type="button" :aria-current="mobileStage === 'source' ? 'step' : undefined" @click="mobileStage = 'source'">
        <span aria-hidden="true">1</span>{{ locale.t('import.source', 'Source') }}
      </button>
      <button type="button" :aria-current="mobileStage === 'diagnostics' ? 'step' : undefined" @click="mobileStage = 'diagnostics'">
        <span aria-hidden="true">2</span>{{ locale.t('import.diagnostics', 'Diagnostics') }}
      </button>
      <button type="button" :aria-current="mobileStage === 'preview' ? 'step' : undefined" :disabled="!prepared" @click="mobileStage = 'preview'">
        <span aria-hidden="true">3</span>{{ locale.t('import.preview', 'Preview') }}
      </button>
    </nav>

    <div class="json-import-layout">
      <section class="json-import-source" :class="{ 'is-mobile-hidden': mobileStage !== 'source' }">
        <header>
          <div class="json-import-panel-title">
            <FileJson2 :size="17" aria-hidden="true" />
            <h2>{{ locale.t('import.source', 'Source') }}</h2>
          </div>
          <ElSegmented v-model="sourceMode" :aria-label="locale.t('import.sourceMode', 'JSON source mode')" :options="sourceModeOptions" />
        </header>

        <ElInput
          v-if="sourceMode === 'paste'"
            ref="sourceInput"
          v-model="source"
          class="json-import-textarea"
          type="textarea"
          :rows="18"
          resize="none"
          spellcheck="false"
          :aria-label="locale.t('import.pasteLabel', 'Config Model JSON')"
          :placeholder="locale.t('import.pastePlaceholder', 'Paste Project or Page JSON')"
          @input="resetAnalysis(false)"
        />
        <div v-else ref="uploadPanel" class="json-import-upload">
          <ElUpload
            ref="upload"
            drag
            accept=".json,application/json"
            :auto-upload="false"
            :limit="1"
            :show-file-list="false"
            :on-change="handleFileChange"
            :on-exceed="replaceFile"
          >
            <Upload :size="24" aria-hidden="true" />
            <strong>{{ locale.t('import.chooseFile', 'Choose JSON file') }}</strong>
          </ElUpload>
          <div v-if="selectedFilename" class="json-import-file-meta">
            <FileJson2 :size="16" aria-hidden="true" />
            <span><strong>{{ selectedFilename }}</strong><small>{{ formatBytes(selectedFileSize) }}</small></span>
          </div>
        </div>

        <footer>
          <ElButton native-type="button" :disabled="!source && !selectedFilename" @click="clearSource">
            <Trash2 :size="15" aria-hidden="true" />{{ locale.t('import.clear', 'Clear') }}
          </ElButton>
          <ElButton native-type="button" type="primary" :loading="analyzing" :disabled="!ready" @click="analyze">
            <SearchCheck :size="15" aria-hidden="true" />{{ locale.t('import.analyze', 'Analyze JSON') }}
          </ElButton>
        </footer>
      </section>

      <section class="json-import-inspection" :class="{ 'is-mobile-hidden': mobileStage === 'source' }">
        <div class="json-import-diagnostics" :class="{ 'is-mobile-hidden': mobileStage !== 'diagnostics' }">
          <header>
            <div class="json-import-panel-title"><SearchCheck :size="17" aria-hidden="true" /><h2>{{ locale.t('import.diagnostics', 'Diagnostics') }}</h2></div>
            <span v-if="prepared" class="json-import-status is-ready"><CheckCircle2 :size="14" aria-hidden="true" />{{ locale.t('import.ready', 'Ready') }}</span>
          </header>
          <p v-if="analyzing" role="status">{{ locale.t('import.analyzing', 'Analyzing JSON') }}</p>
          <div v-else-if="hasErrors" class="json-import-error-summary" role="alert">
            <strong>{{ locale.t('import.blocked', 'Import blocked') }}</strong>
            <ul>
              <li v-for="item in diagnostics" :key="`${item.code}:${item.path}:${item.message}`">
                <code>{{ item.code }}</code><span>{{ item.path }}</span><p>{{ diagnosticMessage(item) }}</p>
              </li>
            </ul>
          </div>
          <div v-else-if="prepared" class="json-import-report">
            <dl>
              <div><dt>{{ locale.t('import.type', 'Type') }}</dt><dd>{{ targetLabel }}</dd></div>
              <div><dt>{{ locale.t('import.name', 'Name') }}</dt><dd>{{ prepared.summary.name }}</dd></div>
              <div><dt>{{ locale.t('template.adapter', 'Adapter') }}</dt><dd>{{ prepared.summary.adapter }}</dd></div>
              <div><dt>{{ locale.t('import.pages', 'Pages') }}</dt><dd>{{ prepared.summary.pageCount }}</dd></div>
              <div><dt>{{ locale.t('import.nodes', 'Nodes') }}</dt><dd>{{ prepared.summary.nodeCount }}</dd></div>
              <div><dt>Flows</dt><dd>{{ prepared.summary.flowCount }}</dd></div>
              <div><dt>{{ locale.t('import.resources', 'Resources') }}</dt><dd>{{ prepared.summary.resourceCount }}</dd></div>
              <div><dt>PageGraph</dt><dd>v{{ prepared.summary.pageGraphVersion }}</dd></div>
              <div v-if="prepared.summary.version"><dt>{{ locale.t('import.version', 'Project version') }}</dt><dd>v{{ prepared.summary.version }}</dd></div>
            </dl>
          </div>
          <div v-else class="json-import-empty">
            <SearchCheck :size="22" aria-hidden="true" />
            <span>{{ locale.t('import.awaiting', 'Awaiting analysis') }}</span>
          </div>
        </div>

        <div class="json-import-preview" :class="{ 'is-mobile-hidden': mobileStage !== 'preview' }">
          <header><div class="json-import-panel-title"><CheckCircle2 :size="17" aria-hidden="true" /><h2>{{ locale.t('import.preview', 'Preview') }}</h2></div></header>
          <PreviewRuntimeHostFrame
            v-if="prepared"
            :adapter="prepared.preview.adapter"
            :compilation="prepared.preview.compilation"
            :locale="locale.locale"
            :namespace="prepared.preview.namespace"
            :reaction-projection="prepared.preview.reactionProjection"
            :revision="prepared.preview.revision"
            :runtime-session-key="prepared.preview.runtimeSessionKey"
            :runtime-state="prepared.preview.runtimeState"
            :title="locale.t('import.previewTitle', 'Imported page Runtime preview')"
            @field-change="handleFieldChange"
            @runtime-state="handleRuntimeState"
          />
          <div v-else class="json-import-empty"><FileJson2 :size="22" aria-hidden="true" /><span>{{ locale.t('import.previewUnavailable', 'Preview unavailable') }}</span></div>
        </div>
      </section>
    </div>

    <footer class="json-import-footer">
      <p v-if="ui.message.value" role="alert">{{ ui.message.value }}</p>
      <span v-else>{{ prepared ? locale.t('import.confirmHint', 'Creates a new independent instance.') : locale.t('import.confirmUnavailable', 'Analyze valid JSON before creating.') }}</span>
      <div>
        <ElButton v-if="hasErrors && source.trim()" native-type="button" @click="analyze"><RotateCcw :size="15" aria-hidden="true" />{{ locale.t('import.retry', 'Retry') }}</ElButton>
        <ElButton native-type="button" type="primary" :loading="submitting" :disabled="!prepared || controller.busy.value" @click="createImported">{{ createLabel }}</ElButton>
      </div>
    </footer>
  </section>
</template>
