<script setup lang="ts">
import type { DatasetProjection } from '@moluoxixi/config-form-model'
import type { UploadFile, UploadInstance } from 'element-plus'
import type { AssetManagerDialogProps } from './types'
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Database,
  Download,
  FilePlus2,
  FileText,
  Image,
  Link2,
  List,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Table2,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, ref, watch } from 'vue'
import DatasetIngestPanel from './components/DatasetIngestPanel.vue'
import DatasetProjectionBuilder from './components/DatasetProjectionBuilder.vue'
import DatasetTableEditor from './components/DatasetTableEditor.vue'

const props = defineProps<AssetManagerDialogProps>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const locale = computed(() => createDesignerLocale(props.locale))
const kind = ref<'dataset' | 'resource'>(props.initialKind ?? 'dataset')
const selectedId = ref(props.initialId ?? '')
const datasetName = ref('')
const datasetJson = ref('[]')
const projectionJson = ref('')
const resourceName = ref('')
const resourceUrl = ref('')
const resourceMediaType = ref('')
const resourceIntegrity = ref('')
const message = ref('')
const pendingFile = ref<File>()
const importStrategy = ref<'copy' | 'overwrite' | 'skip'>('copy')
const datasetImport = ref<UploadInstance>()
const resourceImport = ref<UploadInstance>()
const resourceFile = ref<UploadInstance>()
const resourceReplacementFile = ref<UploadInstance>()
const resourceEmptyFile = ref<UploadInstance>()
const messageTone = ref<'success' | 'error'>('success')
const resourceBusy = ref(false)
const mobilePane = ref<'list' | 'editor'>('list')
const datasetTab = ref('table')
const datasetCells = ref<Record<string, string>>({})
const datasetDrafts = new Map<string, { json: string, projection: string, cells: Record<string, string> }>()
let loadedDatasetId = ''
const loadedRows = ref('[]')
const loadedProjection = ref('')
const datasetDirty = computed(
  () =>
    datasetJson.value !== loadedRows.value
    || projectionJson.value !== loadedProjection.value
    || Object.keys(datasetCells.value).length > 0,
)

const datasets = computed(() => props.project.datasetOrder
  .map(id => props.project.datasetsById[id])
  .filter((dataset): dataset is NonNullable<typeof dataset> => dataset !== undefined),
)
const resources = computed(() => Object.values(props.project.resources)
  .sort((left, right) => left.name.localeCompare(right.name)),
)
const selectedDataset = computed(() => kind.value === 'dataset'
  ? props.project.datasetsById[selectedId.value]
  : undefined,
)
const selectedResource = computed(() => kind.value === 'resource'
  ? props.project.resources[selectedId.value]
  : undefined,
)
const totalAssets = computed(() => datasets.value.length + resources.value.length)
const selectedAssetLabel = computed(() => kind.value === 'dataset'
  ? locale.value.t('assets.dataset', 'Dataset')
  : locale.value.t('assets.resource', 'Resource'),
)

watch(
  [() => props.initialId, () => props.initialKind, () => props.modelValue],
  () => {
    pendingFile.value = undefined
    message.value = ''
    if (!props.modelValue)
      return
    kind.value = props.initialKind ?? kind.value
    selectedId.value = props.initialId ?? selectedId.value
    ensureSelection()
    mobilePane.value = props.initialId || totalAssets.value === 0 ? 'editor' : 'list'
  },
  { immediate: true },
)

watch(
  [() => selectedDataset.value?.id, () => selectedDataset.value?.name],
  ([, name]) => {
    datasetName.value = name ?? ''
  },
  { immediate: true },
)

watch(
  () => selectedDataset.value?.id,
  () => {
    datasetTab.value = 'table'
  },
)

watch(
  () => props.project.id,
  () => {
    datasetDrafts.clear()
    loadedDatasetId = ''
  },
  { flush: 'sync' },
)

watch(
  selectedDataset,
  (dataset) => {
    if (loadedDatasetId) {
      if (datasetDirty.value) {
        datasetDrafts.set(loadedDatasetId, {
          json: datasetJson.value,
          projection: projectionJson.value,
          cells: datasetCells.value,
        })
      }
      else {
        datasetDrafts.delete(loadedDatasetId)
      }
    }
    loadedDatasetId = dataset?.id ?? ''
    loadedRows.value = JSON.stringify(dataset?.rows ?? [], null, 2)
    loadedProjection.value = JSON.stringify(dataset?.defaultProjection, null, 2) ?? ''
    const draft = datasetDrafts.get(loadedDatasetId)
    datasetJson.value = draft?.json ?? loadedRows.value
    projectionJson.value = draft?.projection ?? loadedProjection.value
    datasetCells.value = draft?.cells ?? {}
  },
  { immediate: true },
)

function discardDatasetDraft(): void {
  datasetDrafts.delete(loadedDatasetId)
  datasetJson.value = loadedRows.value
  projectionJson.value = loadedProjection.value
  datasetCells.value = {}
}

watch(
  [() => selectedResource.value?.id, () => selectedResource.value?.name],
  ([, name]) => {
    resourceName.value = name ?? ''
  },
  { immediate: true },
)

watch(
  [
    () => selectedResource.value?.id,
    () => {
      const resource = selectedResource.value
      return resource?.kind === 'url' ? resource.url : ''
    },
  ],
  ([, url]) => {
    resourceUrl.value = url ?? ''
  },
  { immediate: true },
)

watch(
  [() => selectedResource.value?.id, () => selectedResource.value?.mediaType],
  ([, mediaType]) => {
    resourceMediaType.value = mediaType ?? ''
  },
  { immediate: true },
)

watch(
  [
    () => selectedResource.value?.id,
    () => {
      const resource = selectedResource.value
      return resource?.kind === 'url' ? resource.integrity : ''
    },
  ],
  ([, integrity]) => {
    resourceIntegrity.value = integrity ?? ''
  },
  { immediate: true },
)

watch(
  () => selectedResource.value?.id,
  () => {
    pendingFile.value = undefined
  },
)

function ensureSelection(): void {
  if (kind.value === 'dataset') {
    if (props.project.datasetsById[selectedId.value])
      return
    if (datasets.value[0]) {
      selectedId.value = datasets.value[0].id
      return
    }
    if (resources.value[0]) {
      kind.value = 'resource'
      selectedId.value = resources.value[0].id
      return
    }
    selectedId.value = ''
    return
  }
  if (props.project.resources[selectedId.value])
    return
  if (resources.value[0]) {
    selectedId.value = resources.value[0].id
    return
  }
  if (datasets.value[0]) {
    kind.value = 'dataset'
    selectedId.value = datasets.value[0].id
    return
  }
  selectedId.value = ''
}

function select(nextKind: 'dataset' | 'resource', id: string): void {
  kind.value = nextKind
  selectedId.value = id
  mobilePane.value = 'editor'
  message.value = ''
}

function handlePaneKeydown(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return
  event.preventDefault()
  mobilePane.value = event.key === 'Home' ? 'list' : event.key === 'End' ? 'editor' : mobilePane.value === 'list' ? 'editor' : 'list'
  const tabs = (event.currentTarget as HTMLElement).parentElement
  void nextTick(() => tabs?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus())
}

function setMessage(value: string, tone: 'success' | 'error' = 'success'): void {
  message.value = value
  messageTone.value = tone
}

function parseRows(): unknown | undefined {
  try {
    const rows = JSON.parse(datasetJson.value)
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
      throw new TypeError('Dataset rows must be objects.')
    return rows
  }
  catch {
    setMessage(locale.value.t('assets.datasetJsonInvalid', 'Enter a valid JSON array of objects.'), 'error')
  }
}

function createDataset(): void {
  const id = props.commands.createDataset(locale.value.t('assets.dataset', 'Dataset'), [])
  if (id)
    select('dataset', id)
  else
    setMessage(locale.value.t('assets.datasetCreateRejected', 'Dataset could not be created.'), 'error')
}

function saveDatasetRows(): boolean {
  const rows = parseRows()
  if (!rows || !selectedDataset.value)
    return false
  if (
    JSON.stringify(rows) === JSON.stringify(selectedDataset.value.rows)
    || props.commands.replaceDatasetRows(selectedDataset.value.id, rows)
  ) {
    loadedRows.value = JSON.stringify(rows, null, 2)
    datasetJson.value = loadedRows.value
    datasetCells.value = {}
    setMessage(locale.value.t('assets.datasetSaved', 'Dataset saved.'))
    return true
  }
  setMessage(locale.value.t('assets.datasetRowsRejected', 'Dataset rows were rejected.'), 'error')
  return false
}

function applyIngest(rows: unknown[]): void {
  datasetJson.value = JSON.stringify(rows, null, 2)
  if (saveDatasetRows())
    datasetTab.value = 'table'
}

function saveProjection(): void {
  const dataset = selectedDataset.value
  if (!dataset)
    return
  try {
    const projection = projectionJson.value.trim()
      ? (JSON.parse(projectionJson.value) as DatasetProjection)
      : undefined
    if (
      JSON.stringify(projection) !== JSON.stringify(dataset.defaultProjection)
      && !props.commands.setDatasetDefaultProjection(dataset.id, projection)
    ) {
      setMessage(locale.value.t('assets.projectionRejected', 'Dataset projection was rejected.'), 'error')
    }
    else {
      loadedProjection.value = JSON.stringify(projection, null, 2) ?? ''
      projectionJson.value = loadedProjection.value
      setMessage(locale.value.t('assets.projectionSaved', 'Default projection saved.'))
    }
  }
  catch {
    setMessage(locale.value.t('assets.projectionJsonInvalid', 'Enter valid JSON for the mapping.'), 'error')
  }
}

function renameDataset(): void {
  const dataset = selectedDataset.value
  if (dataset && dataset.name !== datasetName.value)
    props.commands.renameDataset(dataset.id, datasetName.value)
}

async function removeDataset(): Promise<void> {
  const dataset = selectedDataset.value
  if (!dataset)
    return
  if (props.commands.deleteDataset(dataset.id)) {
    selectedId.value = ''
    await nextTick()
    ensureSelection()
    if (totalAssets.value === 0)
      mobilePane.value = 'editor'
    message.value = ''
  }
  else {
    setMessage(locale.value.t('assets.datasetDeleteBlocked', 'Dataset is referenced and cannot be deleted.'), 'error')
  }
}

function download(name: string, payload: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportDataset(): void {
  const dataset = selectedDataset.value
  const transfer = dataset && props.commands.exportDataset(dataset.id)
  if (transfer?.success)
    download(`${dataset!.name || 'dataset'}.config-form-dataset.json`, transfer.data)
}

async function importDataset(uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file)
    return
  try {
    const id = props.commands.importDataset(JSON.parse(await file.text()), importStrategy.value)
    if (id)
      select('dataset', id)
    else
      setMessage(locale.value.t('assets.datasetImportRejected', 'Dataset import was rejected.'), 'error')
  }
  catch {
    setMessage(locale.value.t('assets.datasetImportRejected', 'Dataset import was rejected.'), 'error')
  }
  finally {
    datasetImport.value?.clearFiles()
  }
}

function newUrlResource(): void {
  const id = props.commands.createUrlResource({
    name: locale.value.t('assets.resource', 'Resource'),
    url: 'https://example.com/',
  })
  if (id)
    select('resource', id)
  else
    setMessage(locale.value.t('assets.resourceCreateRejected', 'Resource URL was rejected.'), 'error')
}

function selectReplacementFile(uploadFile: UploadFile): void {
  pendingFile.value = uploadFile.raw
  resourceReplacementFile.value?.clearFiles()
}

async function createEmbeddedResource(uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file || resourceBusy.value)
    return
  resourceBusy.value = true
  try {
    const id = await props.commands.createEmbeddedResource({
      name: file.name,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    if (id)
      select('resource', id)
    else
      setMessage(locale.value.t('assets.embeddedCreateRejected', 'Embedded Resource was rejected.'), 'error')
  }
  catch {
    setMessage(locale.value.t('assets.embeddedCreateRejected', 'Embedded Resource was rejected.'), 'error')
  }
  finally {
    resourceBusy.value = false
    resourceFile.value?.clearFiles()
    resourceEmptyFile.value?.clearFiles()
  }
}

function saveUrlResource(): void {
  const resource = selectedResource.value
  if (!resource || resource.kind !== 'url')
    return
  if (!props.commands.replaceUrlResource(resource.id, {
    name: resourceName.value,
    url: resourceUrl.value,
    mediaType: resourceMediaType.value,
    integrity: resourceIntegrity.value,
  })) {
    setMessage(locale.value.t('assets.resourceUrlRejected', 'Resource URL was rejected.'), 'error')
  }
  else {
    setMessage(locale.value.t('assets.resourceSaved', 'Resource saved.'))
  }
}

async function replaceEmbeddedResource(): Promise<void> {
  const resource = selectedResource.value
  const file = pendingFile.value
  if (!resource || resource.kind !== 'embedded' || !file || resourceBusy.value)
    return
  resourceBusy.value = true
  try {
    const replaced = await props.commands.replaceEmbeddedResource(resource.id, {
      name: resourceName.value,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    if (selectedResource.value?.id !== resource.id)
      return
    if (!replaced) {
      setMessage(locale.value.t('assets.resourceReplacementRejected', 'Resource replacement was rejected.'), 'error')
      return
    }
    pendingFile.value = undefined
    setMessage(locale.value.t('assets.resourceSaved', 'Resource saved.'))
  }
  catch {
    setMessage(locale.value.t('assets.resourceReplacementRejected', 'Resource replacement was rejected.'), 'error')
  }
  finally {
    resourceBusy.value = false
    resourceReplacementFile.value?.clearFiles()
  }
}

function renameResource(): void {
  const resource = selectedResource.value
  if (resource && resource.name !== resourceName.value)
    props.commands.renameResource(resource.id, resourceName.value)
}

async function removeResource(): Promise<void> {
  const resource = selectedResource.value
  if (!resource)
    return
  if (props.commands.deleteResource(resource.id)) {
    selectedId.value = ''
    await nextTick()
    ensureSelection()
    if (totalAssets.value === 0)
      mobilePane.value = 'editor'
    message.value = ''
  }
  else {
    setMessage(
      locale.value.t('assets.resourceDeleteBlocked', 'Resource is referenced and cannot be deleted.'),
      'error',
    )
  }
}

async function exportResource(): Promise<void> {
  const resource = selectedResource.value
  const transfer = resource && (await props.commands.exportResource(resource.id))
  if (transfer?.success)
    download(`${resource!.name || 'resource'}.config-form-resource.json`, transfer.data)
}

async function importResource(uploadFile: UploadFile): Promise<void> {
  const file = uploadFile.raw
  if (!file)
    return
  try {
    const id = await props.commands.importResource(JSON.parse(await file.text()), importStrategy.value)
    if (id)
      select('resource', id)
    else
      setMessage(locale.value.t('assets.resourceImportRejected', 'Resource import was rejected.'), 'error')
  }
  catch {
    setMessage(locale.value.t('assets.resourceImportRejected', 'Resource import was rejected.'), 'error')
  }
  finally {
    resourceImport.value?.clearFiles()
  }
}
</script>

<template>
  <ElDialog
    class="asset-manager-dialog"
    :model-value="modelValue"
    :width="selectedDataset ? 'min(1280px, calc(100vw - 32px))' : 'min(1040px, calc(100vw - 32px))'"
    :title="locale.t('assets.title', 'Assets')"
    append-to="#workbench-overlays"
    align-center
    transition="none"
    data-asset-manager
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header="{ titleId }">
      <div class="asset-manager__dialog-title flex min-w-0 items-center gap-2">
        <Database :size="18" aria-hidden="true" />
        <h2 :id="titleId">
          {{ locale.t('assets.title', 'Assets') }}
        </h2>
      </div>
    </template>

    <div class="asset-manager-shell flex min-h-0 flex-1 flex-col overflow-hidden" :data-active-pane="mobilePane">
      <div
        class="asset-manager__mobile-navigation"
        role="tablist"
        :aria-label="locale.t('assets.views', 'Asset views')"
      >
        <button
          id="asset-list-tab"
          type="button"
          role="tab"
          :aria-selected="mobilePane === 'list'"
          :tabindex="mobilePane === 'list' ? 0 : -1"
          aria-controls="asset-list-panel"
          @click="mobilePane = 'list'"
          @keydown="handlePaneKeydown"
        >
          <List :size="15" aria-hidden="true" />{{ locale.t('assets.list', 'Asset list')
          }}<span aria-hidden="true">{{ totalAssets }}</span>
        </button>
        <button
          id="asset-editor-tab"
          type="button"
          role="tab"
          :aria-selected="mobilePane === 'editor'"
          :tabindex="mobilePane === 'editor' ? 0 : -1"
          aria-controls="asset-editor-panel"
          @click="mobilePane = 'editor'"
          @keydown="handlePaneKeydown"
        >
          <Pencil :size="15" aria-hidden="true" />{{ locale.t('assets.details', 'Details') }}
        </button>
      </div>
      <div class="asset-manager" :class="{ 'has-dataset': selectedDataset }">
        <aside
          id="asset-list-panel"
          class="asset-manager__list"
          :aria-label="locale.t('assets.list', 'Asset list')"
          data-asset-navigation
        >
          <section class="asset-manager__group">
            <div class="asset-manager__heading">
              <div class="asset-manager__section-label">
                <Database :size="14" aria-hidden="true" /><strong>{{ locale.t('assets.datasets', 'Datasets') }}</strong><span>{{ datasets.length }}</span>
              </div>
              <ElButton
                text
                circle
                :title="locale.t('assets.newDataset', 'New Dataset')"
                :aria-label="locale.t('assets.newDataset', 'New Dataset')"
                @click="createDataset"
              >
                <Plus :size="15" aria-hidden="true" />
              </ElButton>
            </div>
            <nav class="asset-manager__items" :aria-label="locale.t('assets.datasets', 'Datasets')">
              <ElButton
                v-for="dataset in datasets"
                :key="dataset.id"
                text
                class="asset-manager__item"
                :class="{ 'is-active': kind === 'dataset' && selectedId === dataset.id }"
                :aria-pressed="kind === 'dataset' && selectedId === dataset.id"
                :title="dataset.name"
                @click="select('dataset', dataset.id)"
              >
                <Database :size="14" aria-hidden="true" /><span class="asset-manager__item-name">{{
                  dataset.name
                }}</span><small>{{ dataset.rows.length }}</small>
              </ElButton>
              <p v-if="datasets.length === 0" class="asset-manager__empty-list">
                {{ locale.t('assets.emptyDatasets', 'No datasets yet') }}
              </p>
            </nav>
            <div class="asset-manager__actions">
              <ElUpload
                ref="datasetImport"
                class="asset-manager__upload"
                data-asset-dataset-import-file
                accept="application/json,.json"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="importDataset"
              >
                <ElButton tag="span" size="small" data-asset-dataset-import>
                  <Upload :size="13" aria-hidden="true" />{{ locale.t('assets.import', 'Import') }}
                </ElButton>
              </ElUpload>
            </div>
          </section>

          <section class="asset-manager__group">
            <div class="asset-manager__heading">
              <div class="asset-manager__section-label">
                <Image :size="14" aria-hidden="true" /><strong>{{ locale.t('assets.resources', 'Resources') }}</strong><span>{{ resources.length }}</span>
              </div>
              <ElButton
                text
                circle
                :title="locale.t('assets.newUrlResource', 'New URL Resource')"
                :aria-label="locale.t('assets.newUrlResource', 'New URL Resource')"
                @click="newUrlResource"
              >
                <Plus :size="15" aria-hidden="true" />
              </ElButton>
            </div>
            <nav class="asset-manager__items" :aria-label="locale.t('assets.resources', 'Resources')">
              <ElButton
                v-for="resource in resources"
                :key="resource.id"
                text
                class="asset-manager__item"
                :class="{ 'is-active': kind === 'resource' && selectedId === resource.id }"
                :aria-pressed="kind === 'resource' && selectedId === resource.id"
                :title="resource.name"
                @click="select('resource', resource.id)"
              >
                <Link2 v-if="resource.kind === 'url'" :size="14" aria-hidden="true" /><FileText
                  v-else
                  :size="14"
                  aria-hidden="true"
                /><span class="asset-manager__item-name">{{ resource.name }}</span><small>{{
                  resource.kind === 'url'
                    ? locale.t('assets.urlResourceType', 'URL')
                    : locale.t('assets.fileResourceType', 'File')
                }}</small>
              </ElButton>
              <p v-if="resources.length === 0" class="asset-manager__empty-list">
                {{ locale.t('assets.emptyResources', 'No resources yet') }}
              </p>
            </nav>
            <div class="asset-manager__actions">
              <ElUpload
                ref="resourceImport"
                class="asset-manager__upload"
                data-asset-resource-import-file
                accept="application/json,.json"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="importResource"
              >
                <ElButton tag="span" size="small" data-asset-resource-import>
                  <Upload :size="13" aria-hidden="true" />{{ locale.t('assets.import', 'Import') }}
                </ElButton>
              </ElUpload>
              <ElUpload
                ref="resourceFile"
                class="asset-manager__upload"
                data-asset-resource-file
                :disabled="resourceBusy"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="createEmbeddedResource"
              >
                <ElButton tag="span" size="small" data-asset-resource-file-picker :loading="resourceBusy">
                  <FilePlus2 :size="13" aria-hidden="true" />{{ locale.t('assets.addFile', 'Add file') }}
                </ElButton>
              </ElUpload>
            </div>
          </section>

          <label class="asset-manager__conflict-field">
            <span>{{ locale.t('assets.importStrategy', 'When an asset already exists') }}</span>
            <ElSelect
              v-model="importStrategy"
              size="small"
              append-to="#workbench-overlays"
              :aria-label="locale.t('assets.importStrategy', 'Import conflict strategy')"
            >
              <ElOption :label="locale.t('assets.copyOnConflict', 'Copy on conflict')" value="copy" />
              <ElOption :label="locale.t('assets.overwriteOnConflict', 'Overwrite on conflict')" value="overwrite" />
              <ElOption :label="locale.t('assets.skipOnConflict', 'Skip on conflict')" value="skip" />
            </ElSelect>
          </label>
        </aside>

        <section
          v-if="selectedDataset"
          id="asset-editor-panel"
          class="asset-manager__editor flex min-h-0 min-w-0 flex-col overflow-hidden"
          data-asset-dataset-editor
        >
          <header class="asset-manager__editor-header">
            <div class="asset-manager__editor-title">
              <span>{{ selectedAssetLabel }}</span><ElInput
                v-model="datasetName"
                :aria-label="locale.t('assets.datasetName', 'Dataset name')"
                @change="renameDataset"
              />
            </div>
            <div class="asset-manager__editor-actions">
              <ElButton size="small" data-asset-dataset-export :disabled="!selectedDataset" @click="exportDataset">
                <Download :size="13" aria-hidden="true" />{{ locale.t('assets.export', 'Export') }}
              </ElButton>
              <ElButton size="small" type="danger" plain @click="removeDataset">
                <Trash2 :size="14" aria-hidden="true" />{{ locale.t('assets.delete', 'Delete') }}
              </ElButton>
            </div>
          </header>
          <div class="asset-manager__editor-body asset-manager__dataset-body" :class="{ 'has-table': datasetTab === 'table' }">
            <ElTabs v-model="datasetTab" class="asset-manager__tabs">
              <ElTabPane name="json">
                <template #label>
                  <span class="asset-manager__tab-label"><Braces :size="14" aria-hidden="true" />JSON</span>
                </template>
                <ElInput
                  v-model="datasetJson"
                  class="asset-manager__json"
                  data-asset-dataset-json
                  type="textarea"
                  :rows="14"
                  resize="none"
                  :aria-label="locale.t('assets.datasetJson', 'Dataset JSON')"
                />
              </ElTabPane>
              <ElTabPane name="table" class="dataset-table-pane">
                <template #label>
                  <span class="asset-manager__tab-label"><Table2 :size="14" aria-hidden="true" />{{ locale.t('assets.table', 'Table') }}</span>
                </template>
                <DatasetTableEditor
                  :key="selectedDataset.id"
                  v-model:json="datasetJson"
                  v-model:cells="datasetCells"
                  :locale="locale.locale"
                  @save="saveDatasetRows"
                />
              </ElTabPane>
              <ElTabPane name="projection">
                <template #label>
                  <span class="asset-manager__tab-label"><SlidersHorizontal :size="14" aria-hidden="true" />{{
                    locale.t('assets.defaultProjection', 'Default projection')
                  }}</span>
                </template>
                <DatasetProjectionBuilder
                  v-model:json="projectionJson"
                  :dataset="selectedDataset"
                  :locale="locale.locale"
                />
              </ElTabPane>
              <ElTabPane name="ingest" :label="locale.locale === 'zh-CN' ? '导入数据' : 'Import data'">
                <DatasetIngestPanel :locale="locale.locale" @apply="applyIngest" />
              </ElTabPane>
            </ElTabs>
          </div>
          <footer class="asset-manager__editor-footer">
            <span v-if="datasetDirty" role="status">{{
              locale.locale === 'zh-CN'
                ? '有未保存草稿 · 切换或关闭后保留在当前会话'
                : 'Unsaved draft · kept in this session when switching or closing'
            }}</span>
            <ElButton v-if="datasetDirty" size="small" @click="discardDatasetDraft">
              {{ locale.locale === 'zh-CN' ? '放弃草稿' : 'Discard draft' }}
            </ElButton>
            <ElButton v-if="datasetTab === 'json'" type="primary" data-asset-dataset-save @click="saveDatasetRows">
              <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveJson', 'Save JSON') }}
            </ElButton>
            <ElButton v-if="datasetTab === 'projection'" type="primary" @click="saveProjection">
              <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveProjection', 'Save projection') }}
            </ElButton>
          </footer>
        </section>

        <section
          v-else-if="selectedResource"
          id="asset-editor-panel"
          class="asset-manager__editor flex min-h-0 min-w-0 flex-col overflow-hidden"
          data-asset-resource-editor
        >
          <header class="asset-manager__editor-header">
            <div class="asset-manager__editor-title">
              <span>{{ selectedAssetLabel }}</span><ElInput
                v-model="resourceName"
                :aria-label="locale.t('assets.resourceName', 'Resource name')"
                @change="renameResource"
              />
            </div>
            <div class="asset-manager__editor-actions">
              <ElButton size="small" data-asset-resource-export :disabled="!selectedResource" @click="exportResource">
                <Download :size="13" aria-hidden="true" />{{ locale.t('assets.export', 'Export') }}
              </ElButton>
              <ElButton size="small" type="danger" plain :disabled="resourceBusy" @click="removeResource">
                <Trash2 :size="14" aria-hidden="true" />{{ locale.t('assets.delete', 'Delete') }}
              </ElButton>
            </div>
          </header>
          <div class="asset-manager__editor-body">
            <template v-if="selectedResource.kind === 'url'">
              <div class="asset-manager__form-grid">
                <label class="is-wide"><span>{{ locale.t('assets.resourceUrl', 'Resource URL') }}</span><ElInput v-model="resourceUrl" :aria-label="locale.t('assets.resourceUrl', 'Resource URL')" /></label>
                <label><span>{{ locale.t('assets.resourceMediaType', 'Media type') }}</span><ElInput
                  v-model="resourceMediaType"
                  :aria-label="locale.t('assets.resourceMediaTypeAria', 'Resource media type')"
                  placeholder="application/json"
                /></label>
                <label><span>{{ locale.t('assets.resourceIntegrity', 'Integrity') }}</span><ElInput
                  v-model="resourceIntegrity"
                  :aria-label="locale.t('assets.resourceIntegrityAria', 'Resource integrity')"
                  :placeholder="locale.t('assets.resourceIntegrityHint', 'Optional checksum')"
                /></label>
              </div>
            </template>
            <template v-else>
              <dl class="asset-manager__metadata">
                <div>
                  <dt>{{ locale.t('assets.fileName', 'File name') }}</dt>
                  <dd>{{ selectedResource.fileName }}</dd>
                </div>
                <div>
                  <dt>{{ locale.t('assets.resourceMediaType', 'Media type') }}</dt>
                  <dd>{{ selectedResource.mediaType || 'application/octet-stream' }}</dd>
                </div>
                <div>
                  <dt>{{ locale.t('assets.bytes', 'Bytes') }}</dt>
                  <dd>{{ selectedResource.byteLength }} B</dd>
                </div>
                <div>
                  <dt>{{ locale.t('assets.sha256', 'SHA-256') }}</dt>
                  <dd>
                    <code>{{ selectedResource.contentHash }}</code>
                  </dd>
                </div>
              </dl>
              <div class="asset-manager__file-replace">
                <strong>{{ locale.t('assets.replaceFile', 'Replace file') }}</strong>
                <ElUpload
                  ref="resourceReplacementFile"
                  class="asset-manager__upload"
                  data-asset-resource-replacement-file
                  :disabled="resourceBusy"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="selectReplacementFile"
                >
                  <ElButton tag="span" :disabled="resourceBusy">
                    <Upload :size="14" aria-hidden="true" />{{
                      locale.t('assets.chooseReplacement', 'Choose replacement')
                    }}
                  </ElButton>
                </ElUpload>
                <div v-if="pendingFile" class="asset-manager__pending-file">
                  <FileText :size="15" aria-hidden="true" /><span :title="pendingFile.name">{{
                    pendingFile.name
                  }}</span>
                  <ElButton
                    text
                    circle
                    :disabled="resourceBusy"
                    :title="locale.t('assets.clearFile', 'Clear selected file')"
                    :aria-label="locale.t('assets.clearFile', 'Clear selected file')"
                    @click="pendingFile = undefined"
                  >
                    <X :size="14" aria-hidden="true" />
                  </ElButton>
                </div>
              </div>
            </template>
          </div>
          <footer class="asset-manager__editor-footer">
            <ElButton v-if="selectedResource.kind === 'url'" type="primary" @click="saveUrlResource">
              <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveUrl', 'Save URL') }}
            </ElButton>
            <ElButton
              v-else
              :disabled="!pendingFile"
              :loading="resourceBusy"
              type="primary"
              @click="replaceEmbeddedResource"
            >
              <Save :size="14" aria-hidden="true" />{{ locale.t('assets.replace', 'Replace file') }}
            </ElButton>
          </footer>
        </section>

        <section v-else id="asset-editor-panel" class="asset-manager__empty">
          <div class="asset-manager__empty-icon">
            <FilePlus2 :size="22" aria-hidden="true" />
          </div>
          <strong>{{ locale.t('assets.emptyTitle', 'Create your first asset') }}</strong>
          <div class="asset-manager__empty-actions">
            <ElButton type="primary" @click="createDataset">
              <Database :size="14" aria-hidden="true" />{{ locale.t('assets.createDataset', 'Create dataset') }}
            </ElButton>
            <ElButton @click="newUrlResource">
              <Link2 :size="14" aria-hidden="true" />{{ locale.t('assets.createUrlResource', 'Create URL resource') }}
            </ElButton>
            <ElUpload
              ref="resourceEmptyFile"
              class="asset-manager__upload"
              data-asset-resource-empty-file
              :disabled="resourceBusy"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="createEmbeddedResource"
            >
              <ElButton tag="span" :loading="resourceBusy">
                <FilePlus2 :size="14" aria-hidden="true" />{{ locale.t('assets.addFile', 'Add file') }}
              </ElButton>
            </ElUpload>
          </div>
        </section>
      </div>
    </div>
    <div class="asset-manager__status" role="status" aria-live="polite">
      <p v-if="message" class="asset-manager__message" :class="`is-${messageTone}`">
        <CheckCircle2 v-if="messageTone === 'success'" :size="14" aria-hidden="true" /><AlertCircle
          v-else
          :size="14"
          aria-hidden="true"
        />{{ message }}
      </p>
    </div>
  </ElDialog>
</template>

<style src="./style/index.css" scoped />
