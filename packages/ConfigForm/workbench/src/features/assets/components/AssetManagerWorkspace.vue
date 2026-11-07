<script setup lang="ts">
import type { DatasetProjection } from '@moluoxixi/config-form-model'
import type { UploadFile, UploadInstance } from 'element-plus'
import type { AssetManagerWorkspaceProps } from '../types/props'
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
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  Upload,
  X,
} from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import ControlHint from '../../../components/ControlHint.vue'
import WorkbenchCommandHint from '../../../components/WorkbenchCommandHint/index.vue'
import { DatasetIngestPanel, DatasetProjectionBuilder, DatasetTableEditor } from './AssetManagerWorkspace/components'

const props = withDefaults(defineProps<AssetManagerWorkspaceProps>(), { active: true, fill: false })

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
let messageTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(messageTimer))
const assetBusy = ref(false)
const persisting = ref(false)
const saveFailed = ref(false)
const busyReason = computed(() => assetBusy.value || persisting.value ? locale.value.t('action.processing', 'An operation is in progress. Wait for it to finish.') : undefined)

function assetSaveState(dirty: boolean): string {
  return persisting.value
    ? locale.value.t('status.saving', 'Saving')
    : saveFailed.value
      ? locale.value.t('data.saveFailed', 'Save failed; retry to keep your changes.')
      : dirty ? locale.value.t('data.pendingChanges', 'Unsaved changes') : props.saveStatus
}

async function persistChanges(successMessage: string): Promise<boolean> {
  persisting.value = true
  try {
    const saved = await props.commands.saveProject({ announce: false })
    saveFailed.value = !saved
    setMessage(saved ? successMessage : locale.value.t('data.saveFailed', 'Save failed; retry to keep your changes.'), saved ? 'success' : 'error')
    return saved
  }
  catch {
    saveFailed.value = true
    setMessage(locale.value.t('data.saveFailed', 'Save failed; retry to keep your changes.'), 'error')
    return false
  }
  finally {
    persisting.value = false
  }
}
const mobilePane = ref<'list' | 'editor'>('list')
const datasetTab = ref('table')
const tableEditor = useTemplateRef<InstanceType<typeof DatasetTableEditor>>('dataset-table')
const datasetNameInput = useTemplateRef<{ focus: () => void }>('dataset-name')
const sidebarCollapsed = ref(false)
const collapseButton = useTemplateRef<{ ref: HTMLButtonElement }>('collapse-button')
const expandButton = useTemplateRef<{ ref: HTMLButtonElement }>('expand-button')
const datasetCells = ref<Record<string, string>>({})
const datasetDrafts = reactive(new Map<string, { json: string, projection: string, cells: Record<string, string> }>())
let loadedDatasetId = ''
const loadedRows = ref('[]')
const loadedProjection = ref('')
const datasetRowsDirty = computed(
  () =>
    datasetJson.value !== loadedRows.value
    || Object.keys(datasetCells.value).length > 0,
)
const projectionDirty = computed(() => projectionJson.value !== loadedProjection.value)
const datasetDirty = computed(() => datasetRowsDirty.value || projectionDirty.value)

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
const assetQuery = ref('')
const matchingDatasets = computed(() => datasets.value.filter(dataset => !assetQuery.value.trim() || dataset.name.toLocaleLowerCase().includes(assetQuery.value.trim().toLocaleLowerCase())))
const matchingResources = computed(() => resources.value.filter(resource => !assetQuery.value.trim() || `${resource.name} ${resource.kind}`.toLocaleLowerCase().includes(assetQuery.value.trim().toLocaleLowerCase())))
const totalAssets = computed(() => datasets.value.length + resources.value.length)

watch(
  [() => props.initialId, () => props.initialKind, () => props.active],
  () => {
    message.value = ''
    if (!props.active)
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

const resourceDrafts = reactive(new Map<string, { url: string, mediaType: string, integrity: string, file?: File }>())
let loadedResourceId = ''
const loadedResourceUrl = ref('')
const loadedResourceMediaType = ref('')
const loadedResourceIntegrity = ref('')
const resourceDirty = computed(() => Boolean(selectedResource.value) && (
  resourceUrl.value !== loadedResourceUrl.value
  || resourceMediaType.value !== loadedResourceMediaType.value
  || resourceIntegrity.value !== loadedResourceIntegrity.value
  || Boolean(pendingFile.value)
))
watch(selectedResource, (resource) => {
  if (loadedResourceId) {
    if (resourceUrl.value !== loadedResourceUrl.value || resourceMediaType.value !== loadedResourceMediaType.value || resourceIntegrity.value !== loadedResourceIntegrity.value || pendingFile.value) {
      resourceDrafts.set(loadedResourceId, {
        url: resourceUrl.value,
        mediaType: resourceMediaType.value,
        integrity: resourceIntegrity.value,
        file: pendingFile.value,
      })
    }
    else {
      resourceDrafts.delete(loadedResourceId)
    }
  }
  loadedResourceId = resource?.id ?? ''
  loadedResourceUrl.value = resource?.kind === 'url' ? resource.url : ''
  loadedResourceMediaType.value = resource?.mediaType ?? ''
  loadedResourceIntegrity.value = resource?.kind === 'url' ? resource.integrity ?? '' : ''
  const draft = resourceDrafts.get(loadedResourceId)
  resourceUrl.value = draft?.url ?? loadedResourceUrl.value
  resourceMediaType.value = draft?.mediaType ?? loadedResourceMediaType.value
  resourceIntegrity.value = draft?.integrity ?? loadedResourceIntegrity.value
  pendingFile.value = draft?.file
}, { immediate: true })

function discardResourceDraft(): void {
  resourceDrafts.delete(loadedResourceId)
  resourceUrl.value = loadedResourceUrl.value
  resourceMediaType.value = loadedResourceMediaType.value
  resourceIntegrity.value = loadedResourceIntegrity.value
  pendingFile.value = undefined
}

const hasChanges = computed(() => {
  if (saveFailed.value)
    return true
  if ((selectedDataset.value && datasetDirty.value) || resourceDirty.value)
    return true
  for (const [id, draft] of datasetDrafts) {
    const dataset = props.project.datasetsById[id]
    if (id !== loadedDatasetId && dataset && (
      draft.json !== JSON.stringify(dataset.rows, null, 2)
      || draft.projection !== (JSON.stringify(dataset.defaultProjection, null, 2) ?? '')
      || Object.keys(draft.cells).length > 0
    )) {
      return true
    }
  }
  for (const [id, draft] of resourceDrafts) {
    const resource = props.project.resources[id]
    if (id !== loadedResourceId && resource && (
      draft.file
      || draft.url !== (resource.kind === 'url' ? resource.url : '')
      || draft.mediaType !== (resource.mediaType ?? '')
      || draft.integrity !== (resource.kind === 'url' ? resource.integrity ?? '' : '')
    )) {
      return true
    }
  }
  return false
})

watch(() => props.project.id, () => {
  saveFailed.value = false
  resourceDrafts.clear()
  loadedResourceId = ''
  pendingFile.value = undefined
  assetQuery.value = ''
}, { flush: 'sync' })

defineExpose({ hasChanges, busy: computed(() => assetBusy.value || persisting.value), hasDataset: computed(() => Boolean(selectedDataset.value)) })

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

async function toggleSidebar(): Promise<void> {
  sidebarCollapsed.value = !sidebarCollapsed.value
  await nextTick()
  if (sidebarCollapsed.value)
    expandButton.value?.ref?.focus()
  else
    collapseButton.value?.ref?.focus()
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
  clearTimeout(messageTimer)
  message.value = value
  messageTone.value = tone
  if (tone === 'success') {
    messageTimer = setTimeout(() => {
      message.value = ''
    }, 4500)
  }
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

async function createDataset(view: 'table' | 'ingest' = 'table'): Promise<void> {
  const id = props.commands.createDataset(locale.value.t('assets.dataset', 'Dataset'), [])
  if (id) {
    select('dataset', id)
    await nextTick()
    datasetTab.value = view
    if (view === 'table')
      datasetNameInput.value?.focus()
  }
  else {
    setMessage(locale.value.t('assets.datasetCreateRejected', 'Dataset could not be created.'), 'error')
  }
}

function beforeDatasetTabLeave(_next: string | number, current: string | number): boolean {
  return current !== 'table' || !Object.keys(datasetCells.value).length || tableEditor.value?.flushDrafts() !== false
}

function openDatasetImport(): void {
  if (beforeDatasetTabLeave('ingest', datasetTab.value))
    datasetTab.value = 'ingest'
}

async function saveDatasetRows(): Promise<boolean> {
  if (persisting.value)
    return false
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
    return await persistChanges(locale.value.t('assets.datasetSaved', 'Dataset saved.'))
  }
  setMessage(locale.value.t('assets.datasetRowsRejected', 'Dataset rows were rejected.'), 'error')
  return false
}

async function applyIngest(rows: unknown[]): Promise<void> {
  datasetJson.value = JSON.stringify(rows, null, 2)
  if (await saveDatasetRows())
    datasetTab.value = 'table'
}

async function saveProjection(): Promise<void> {
  if (persisting.value)
    return
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
      await persistChanges(locale.value.t('assets.projectionSaved', 'Default projection saved.'))
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
  if (!file || assetBusy.value)
    return
  assetBusy.value = true
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
    assetBusy.value = false
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
  if (!file || assetBusy.value)
    return
  assetBusy.value = true
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
    assetBusy.value = false
    resourceFile.value?.clearFiles()
    resourceEmptyFile.value?.clearFiles()
  }
}

async function saveUrlResource(): Promise<void> {
  if (persisting.value)
    return
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
    await persistChanges(locale.value.t('assets.resourceSaved', 'Resource saved.'))
  }
}

async function replaceEmbeddedResource(): Promise<void> {
  const resource = selectedResource.value
  const file = pendingFile.value
  if (!resource || resource.kind !== 'embedded' || !file || assetBusy.value)
    return
  assetBusy.value = true
  try {
    const replaced = await props.commands.replaceEmbeddedResource(resource.id, {
      name: resourceName.value,
      fileName: file.name,
      mediaType: file.type || 'application/octet-stream',
      bytes: new Uint8Array(await file.arrayBuffer()),
    })
    if (!replaced) {
      if (selectedResource.value?.id === resource.id)
        setMessage(locale.value.t('assets.resourceReplacementRejected', 'Resource replacement was rejected.'), 'error')
      return
    }
    await nextTick()
    resourceDrafts.delete(resource.id)
    if (selectedResource.value?.id !== resource.id)
      return
    pendingFile.value = undefined
    await persistChanges(locale.value.t('assets.resourceSaved', 'Resource saved.'))
  }
  catch {
    setMessage(locale.value.t('assets.resourceReplacementRejected', 'Resource replacement was rejected.'), 'error')
  }
  finally {
    assetBusy.value = false
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
  if (!file || assetBusy.value)
    return
  assetBusy.value = true
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
    assetBusy.value = false
    resourceImport.value?.clearFiles()
  }
}
</script>

<template>
  <div class="asset-manager-workspace" :class="{ 'is-full-page': fill }" data-asset-workspace>
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
      <div class="asset-manager" :class="{ 'has-dataset': selectedDataset, 'is-sidebar-collapsed': fill && sidebarCollapsed }">
        <aside v-if="fill && sidebarCollapsed" class="asset-manager__rail">
          <ElButton ref="expand-button" text circle :title="locale.t('data.expandAssets', 'Expand asset list')" :aria-label="locale.t('data.expandAssets', 'Expand asset list')" aria-controls="asset-list-panel" :aria-expanded="false" @click="toggleSidebar">
            <PanelLeftOpen :size="17" aria-hidden="true" />
          </ElButton>
        </aside>
        <aside
          id="asset-list-panel"
          class="asset-manager__list"
          :aria-label="locale.t('assets.list', 'Asset list')"
          data-asset-navigation
        >
          <div class="asset-manager__list-toolbar flex min-w-0 flex-none items-center gap-1">
            <ElInput v-model="assetQuery" clearable :placeholder="locale.t('data.search', 'Search datasets and resources')" :aria-label="locale.t('data.search', 'Search datasets and resources')">
              <template #prefix>
                <Search :size="14" aria-hidden="true" />
              </template>
            </ElInput>
            <ElButton v-if="fill" ref="collapse-button" text circle :title="locale.t('data.collapseAssets', 'Collapse asset list')" :aria-label="locale.t('data.collapseAssets', 'Collapse asset list')" aria-controls="asset-list-panel" :aria-expanded="true" @click="toggleSidebar">
              <PanelLeftClose :size="17" aria-hidden="true" />
            </ElButton>
          </div>
          <div class="asset-manager__catalog" tabindex="0" role="region" :aria-label="locale.t('assets.list', 'Asset list')">
            <p v-if="assetQuery.trim() && !matchingDatasets.length && !matchingResources.length" class="asset-manager__empty-list" role="status">
              {{ locale.t('data.noResults', 'No matching datasets or resources') }}
            </p>
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
                  @click="createDataset()"
                >
                  <Plus :size="15" aria-hidden="true" />
                </ElButton>
              </div>
              <nav class="asset-manager__items" :aria-label="locale.t('assets.datasets', 'Datasets')">
                <ElButton
                  v-for="dataset in matchingDatasets"
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
                  v-for="resource in matchingResources"
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
                <ControlHint class="asset-manager__upload" :reason="busyReason">
                  <ElUpload
                    ref="resourceFile"
                    data-asset-resource-file
                    :disabled="!!busyReason"
                    :auto-upload="false"
                    :show-file-list="false"
                    :on-change="createEmbeddedResource"
                  >
                    <ElButton tag="span" size="small" data-asset-resource-file-picker :loading="assetBusy">
                      <FilePlus2 :size="13" aria-hidden="true" />{{ locale.t('assets.addFile', 'Add file') }}
                    </ElButton>
                  </ElUpload>
                </ControlHint>
              </div>
            </section>
          </div>
          <ElPopover :width="240" trigger="click" transition="none" :show-after="0" :hide-after="0" append-to="#workbench-overlays" popper-class="asset-import-settings">
            <template #reference>
              <ElButton text size="small" class="asset-manager__import-settings">
                <SlidersHorizontal :size="14" aria-hidden="true" />{{ locale.t('data.importSettings', 'Import settings') }}
              </ElButton>
            </template>
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
          </ElPopover>
        </aside>

        <section
          v-if="selectedDataset"
          id="asset-editor-panel"
          class="asset-manager__editor flex min-h-0 min-w-0 flex-col overflow-hidden"
          data-asset-dataset-editor
        >
          <header class="asset-manager__editor-header">
            <div class="asset-manager__editor-title">
              <ElInput
                ref="dataset-name"
                v-model="datasetName"
                :aria-label="locale.t('assets.datasetName', 'Dataset name')"
                @change="renameDataset"
              >
                <template #prefix>
                  <Database :size="15" aria-hidden="true" />
                </template>
              </ElInput>
            </div>
            <span class="asset-manager__save-state" :class="{ 'is-dirty': datasetDirty || saveFailed }" role="status"><span class="asset-manager__save-dot" aria-hidden="true" />{{ assetSaveState(datasetDirty) }}</span>
            <div class="asset-manager__editor-actions">
              <WorkbenchCommandHint detached :label="locale.t('assets.export', 'Export')" :disabled-reason="busyReason || ((datasetDirty || saveFailed) ? locale.t('data.saveBeforeExport', 'Save or discard draft changes before exporting.') : undefined)">
                <ElButton data-asset-dataset-export :disabled="datasetDirty || saveFailed || persisting" :aria-label="locale.t('assets.export', 'Export')" @click="exportDataset">
                  <Download :size="15" aria-hidden="true" /><span class="asset-manager__action-label">{{ locale.t('assets.export', 'Export') }}</span>
                </ElButton>
              </WorkbenchCommandHint>
              <WorkbenchCommandHint detached :label="locale.t('assets.delete', 'Delete')" :disabled-reason="busyReason">
                <ElButton text class="asset-manager__delete" :disabled="!!busyReason" :aria-label="locale.t('assets.delete', 'Delete')" @click="removeDataset">
                  <Trash2 :size="15" aria-hidden="true" />
                </ElButton>
              </WorkbenchCommandHint>
            </div>
          </header>
          <div class="asset-manager__editor-body asset-manager__dataset-body" :class="{ 'has-table': datasetTab === 'table' }">
            <ElTabs v-model="datasetTab" class="asset-manager__tabs" :before-leave="beforeDatasetTabLeave">
              <ElTabPane name="table" class="dataset-table-pane">
                <template #label>
                  <span class="asset-manager__tab-label"><Table2 :size="14" aria-hidden="true" />{{ locale.t('assets.table', 'Table') }}</span>
                </template>
                <DatasetTableEditor
                  ref="dataset-table"
                  :key="selectedDataset.id"
                  v-model:json="datasetJson"
                  v-model:cells="datasetCells"
                  :dataset-id="`${project.id}:${selectedDataset.id}`"
                  :dirty="datasetRowsDirty || saveFailed"
                  :saving="persisting"
                  :locale="locale.locale"
                  @save="saveDatasetRows"
                  @import="openDatasetImport"
                >
                  <template #footer-actions>
                    <ElButton v-if="datasetDirty" size="small" class="dataset-table-discard" :title="locale.t('data.discardDraft', 'Discard draft')" :aria-label="locale.t('data.discardDraft', 'Discard draft')" @click="discardDatasetDraft">
                      <X :size="14" aria-hidden="true" /><span class="dataset-table-discard-label">{{ locale.t('data.discardDraft', 'Discard draft') }}</span>
                    </ElButton>
                  </template>
                </DatasetTableEditor>
              </ElTabPane>
              <ElTabPane name="json">
                <template #label>
                  <span class="asset-manager__tab-label"><Braces :size="14" aria-hidden="true" />JSON<span v-if="datasetRowsDirty" class="asset-manager__draft-dot" aria-hidden="true" :title="locale.t('data.pendingChanges', 'Unsaved changes')" /></span>
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
              <ElTabPane name="projection">
                <template #label>
                  <span class="asset-manager__tab-label"><SlidersHorizontal :size="14" aria-hidden="true" />{{
                    locale.t('assets.defaultProjection', 'Default projection')
                  }}<span v-if="projectionDirty" class="asset-manager__draft-dot" aria-hidden="true" :title="locale.t('data.pendingChanges', 'Unsaved changes')" /></span>
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
          <footer v-if="datasetTab !== 'table' && (datasetDirty || datasetTab === 'json' || datasetTab === 'projection')" class="asset-manager__editor-footer">
            <span v-if="datasetDirty" role="status">{{
              locale.t('data.draftHint', 'Unsaved draft · save to apply it')
            }}</span>
            <ElButton v-if="datasetDirty" size="small" @click="discardDatasetDraft">
              {{ locale.t('data.discardDraft', 'Discard draft') }}
            </ElButton>
            <WorkbenchCommandHint v-if="datasetTab === 'json'" detached :label="locale.t('assets.saveJson', 'Save JSON')" :disabled-reason="busyReason">
              <ElButton type="primary" :disabled="persisting" :loading="persisting" data-asset-dataset-save @click="saveDatasetRows">
                <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveJson', 'Save JSON') }}
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint v-if="datasetTab === 'projection'" detached :label="locale.t('assets.saveProjection', 'Save projection')" :disabled-reason="busyReason">
              <ElButton type="primary" :disabled="persisting" :loading="persisting" @click="saveProjection">
                <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveProjection', 'Save projection') }}
              </ElButton>
            </WorkbenchCommandHint>
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
              <ElInput
                v-model="resourceName"
                :aria-label="locale.t('assets.resourceName', 'Resource name')"
                @change="renameResource"
              >
                <template #prefix>
                  <Link2 v-if="selectedResource.kind === 'url'" :size="15" aria-hidden="true" /><FileText v-else :size="15" aria-hidden="true" />
                </template>
              </ElInput>
            </div>
            <span class="asset-manager__save-state" :class="{ 'is-dirty': resourceDirty || saveFailed }" role="status"><span class="asset-manager__save-dot" aria-hidden="true" />{{ assetSaveState(resourceDirty) }}</span>
            <div class="asset-manager__editor-actions">
              <WorkbenchCommandHint detached :label="locale.t('assets.export', 'Export')" :disabled-reason="busyReason || ((resourceDirty || saveFailed) ? locale.t('data.saveBeforeExport', 'Save or discard draft changes before exporting.') : undefined)">
                <ElButton data-asset-resource-export :aria-label="locale.t('assets.export', 'Export')" :disabled="assetBusy || resourceDirty || saveFailed || persisting" @click="exportResource">
                  <Download :size="15" aria-hidden="true" /><span class="asset-manager__action-label">{{ locale.t('assets.export', 'Export') }}</span>
                </ElButton>
              </WorkbenchCommandHint>
              <WorkbenchCommandHint detached :label="locale.t('assets.delete', 'Delete')" :disabled-reason="busyReason">
                <ElButton text class="asset-manager__delete" :aria-label="locale.t('assets.delete', 'Delete')" :disabled="!!busyReason" @click="removeResource">
                  <Trash2 :size="15" aria-hidden="true" />
                </ElButton>
              </WorkbenchCommandHint>
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
                <ControlHint class="asset-manager__upload" :reason="busyReason">
                  <ElUpload
                    ref="resourceReplacementFile"
                    data-asset-resource-replacement-file
                    :disabled="!!busyReason"
                    :auto-upload="false"
                    :show-file-list="false"
                    :on-change="selectReplacementFile"
                  >
                    <ElButton tag="span" :disabled="!!busyReason">
                      <Upload :size="14" aria-hidden="true" />{{
                        locale.t('assets.chooseReplacement', 'Choose replacement')
                      }}
                    </ElButton>
                  </ElUpload>
                </ControlHint>
                <div v-if="pendingFile" class="asset-manager__pending-file">
                  <FileText :size="15" aria-hidden="true" /><span :title="pendingFile.name">{{
                    pendingFile.name
                  }}</span>
                  <ControlHint :reason="busyReason">
                    <ElButton
                      text
                      circle
                      :disabled="!!busyReason"
                      :title="locale.t('assets.clearFile', 'Clear selected file')"
                      :aria-label="locale.t('assets.clearFile', 'Clear selected file')"
                      @click="pendingFile = undefined"
                    >
                      <X :size="14" aria-hidden="true" />
                    </ElButton>
                  </ControlHint>
                </div>
              </div>
            </template>
          </div>
          <footer class="asset-manager__editor-footer">
            <span v-if="resourceDirty" role="status">{{ locale.t('data.draftHint', 'Unsaved draft · save to apply it') }}</span>
            <ElButton v-if="resourceDirty" size="small" @click="discardResourceDraft">
              {{ locale.t('data.discardDraft', 'Discard draft') }}
            </ElButton>
            <WorkbenchCommandHint v-if="selectedResource.kind === 'url'" detached :label="locale.t('assets.saveUrl', 'Save URL')" :disabled-reason="busyReason">
              <ElButton type="primary" :disabled="!!busyReason" :loading="persisting" @click="saveUrlResource">
                <Save :size="14" aria-hidden="true" />{{ locale.t('assets.saveUrl', 'Save URL') }}
              </ElButton>
            </WorkbenchCommandHint>
            <WorkbenchCommandHint v-else detached :label="locale.t('assets.replace', 'Replace file')" :disabled-reason="busyReason || (!pendingFile && !saveFailed ? locale.t('assets.chooseFileFirst', 'Choose a replacement file first.') : undefined)">
              <ElButton :disabled="!!busyReason || (!pendingFile && !saveFailed)" :loading="assetBusy || persisting" type="primary" @click="saveFailed && !pendingFile ? persistChanges(locale.t('assets.resourceSaved', 'Resource saved.')) : replaceEmbeddedResource()">
                <Save :size="14" aria-hidden="true" />{{ saveFailed && !pendingFile ? locale.t('action.save', 'Save') : locale.t('assets.replace', 'Replace file') }}
              </ElButton>
            </WorkbenchCommandHint>
          </footer>
        </section>

        <section v-else id="asset-editor-panel" class="asset-manager__empty">
          <div class="asset-manager__empty-icon">
            <FilePlus2 :size="22" aria-hidden="true" />
          </div>
          <strong>{{ locale.t('assets.emptyTitle', 'Bring data into your forms') }}</strong>
          <p class="asset-manager__empty-description">
            {{ locale.t('data.emptyDescription', 'Create reusable data for selects, lists and tables, or import a CSV or JSON file.') }}
          </p>
          <div class="asset-manager__empty-actions">
            <ElButton type="primary" @click="createDataset()">
              <Database :size="14" aria-hidden="true" />{{ locale.t('assets.createDataset', 'Create dataset') }}
            </ElButton>
            <ElButton @click="createDataset('ingest')">
              <Upload :size="14" aria-hidden="true" />{{ locale.t('data.importRows', 'Import CSV / JSON') }}
            </ElButton>
          </div>
          <div class="asset-manager__empty-resources">
            <span>{{ locale.t('data.resourceHint', 'Need images or files?') }}</span>
            <ElButton text @click="newUrlResource">
              <Link2 :size="14" aria-hidden="true" />{{ locale.t('assets.createUrlResource', 'Create URL resource') }}
            </ElButton>
            <ControlHint class="asset-manager__upload" :reason="busyReason">
              <ElUpload
                ref="resourceEmptyFile"
                data-asset-resource-empty-file
                :disabled="!!busyReason"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="createEmbeddedResource"
              >
                <ElButton tag="span" text :loading="assetBusy">
                  <FilePlus2 :size="14" aria-hidden="true" />{{ locale.t('assets.addFile', 'Add file') }}
                </ElButton>
              </ElUpload>
            </ControlHint>
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
        /><span>{{ message }}</span>
        <ElButton text circle :aria-label="locale.t('data.dismissMessage', 'Dismiss message')" @click="message = ''">
          <X :size="14" aria-hidden="true" />
        </ElButton>
      </p>
    </div>
  </div>
</template>

<style src="./AssetManagerWorkspace/style/index.css" scoped />
