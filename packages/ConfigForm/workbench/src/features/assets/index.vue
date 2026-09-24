<script setup lang="ts">
import type { UploadFile, UploadInstance } from 'element-plus'
import type { DatasetProjection } from '@moluoxixi/config-form-model'
import type { AssetManagerDialogProps } from './types'
import { Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<AssetManagerDialogProps>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
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

const datasets = computed(() => props.project.datasetOrder
  .map(id => props.project.datasetsById[id])
  .filter((dataset): dataset is NonNullable<typeof dataset> => dataset !== undefined))
const resources = computed(() => Object.values(props.project.resources)
  .sort((left, right) => left.name.localeCompare(right.name)))
const selectedDataset = computed(() => kind.value === 'dataset'
  ? props.project.datasetsById[selectedId.value]
  : undefined)
const selectedResource = computed(() => kind.value === 'resource'
  ? props.project.resources[selectedId.value]
  : undefined)
const tableColumns = computed(() => {
  const dataset = selectedDataset.value
  if (!dataset)
    return []
  return [...new Set(dataset.rows.flatMap(row => Object.keys(row)))].slice(0, 8)
})
const tableRows = computed<Record<string, unknown>[]>(() => selectedDataset.value?.rows.map(cloneDatasetRow) ?? [])

watch([() => props.initialId, () => props.initialKind, () => props.modelValue], () => {
  if (!props.modelValue)
    return
  kind.value = props.initialKind ?? kind.value
  selectedId.value = props.initialId ?? selectedId.value
  ensureSelection()
}, { immediate: true })

watch(selectedDataset, (dataset) => {
  if (!dataset)
    return
  datasetName.value = dataset.name
  datasetJson.value = JSON.stringify(dataset.rows, null, 2)
  projectionJson.value = dataset.defaultProjection ? JSON.stringify(dataset.defaultProjection, null, 2) : ''
}, { immediate: true })

watch(selectedResource, (resource) => {
  if (!resource)
    return
  resourceName.value = resource.name
  resourceUrl.value = resource.kind === 'url' ? resource.url : ''
  resourceMediaType.value = resource.mediaType ?? ''
  resourceIntegrity.value = resource.kind === 'url' ? resource.integrity ?? '' : ''
}, { immediate: true })

function ensureSelection(): void {
  if (kind.value === 'dataset') {
    if (!props.project.datasetsById[selectedId.value])
      selectedId.value = datasets.value[0]?.id ?? ''
    return
  }
  if (!props.project.resources[selectedId.value])
    selectedId.value = resources.value[0]?.id ?? ''
}

function cloneDatasetRow(row: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cloneTableValue(value)]))
}

function cloneTableValue(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(item => cloneTableValue(item))
  if (value && typeof value === 'object')
    return cloneDatasetRow(value)
  return value
}

function select(nextKind: 'dataset' | 'resource', id: string): void {
  kind.value = nextKind
  selectedId.value = id
  message.value = ''
}

function setError(error: unknown, fallback: string): void {
  message.value = error instanceof Error ? error.message : fallback
}

function parseRows(): unknown | undefined {
  try {
    const rows = JSON.parse(datasetJson.value)
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)))
      throw new TypeError('Dataset JSON must be an array of objects.')
    return rows
  }
  catch (error) {
    setError(error, 'Dataset JSON is invalid.')
  }
}

function createDataset(): void {
  const id = props.commands.createDataset('Dataset', [])
  if (id)
    select('dataset', id)
  else
    message.value = 'Dataset could not be created.'
}

function saveDatasetRows(): void {
  const rows = parseRows()
  if (!rows || !selectedDataset.value)
    return
  if (props.commands.replaceDatasetRows(selectedDataset.value.id, rows))
    message.value = 'Dataset saved.'
  else
    message.value = 'Dataset rows were rejected.'
}

function saveProjection(): void {
  const dataset = selectedDataset.value
  if (!dataset)
    return
  try {
    const projection = projectionJson.value.trim()
      ? JSON.parse(projectionJson.value) as DatasetProjection
      : undefined
    if (!props.commands.setDatasetDefaultProjection(dataset.id, projection))
      message.value = 'Dataset projection was rejected.'
    else
      message.value = 'Default projection saved.'
  }
  catch (error) {
    setError(error, 'Projection JSON is invalid.')
  }
}

function renameDataset(): void {
  const dataset = selectedDataset.value
  if (dataset && dataset.name !== datasetName.value)
    props.commands.renameDataset(dataset.id, datasetName.value)
}

function removeDataset(): void {
  const dataset = selectedDataset.value
  if (!dataset)
    return
  if (props.commands.deleteDataset(dataset.id)) {
    selectedId.value = ''
    ensureSelection()
  }
  else {
    message.value = 'Dataset is referenced and cannot be deleted.'
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
      message.value = 'Dataset import was rejected.'
  }
  catch (error) {
    setError(error, 'Dataset import failed.')
  }
  finally {
    datasetImport.value?.clearFiles()
  }
}

function newUrlResource(): void {
  const id = props.commands.createUrlResource({ name: 'Resource', url: 'https://example.com/' })
  if (id)
    select('resource', id)
  else
    message.value = 'Resource URL was rejected.'
}

function selectResourceFile(uploadFile: UploadFile): void {
  pendingFile.value = uploadFile.raw
  resourceFile.value?.clearFiles()
  resourceReplacementFile.value?.clearFiles()
  resourceEmptyFile.value?.clearFiles()
}

async function createEmbeddedResource(): Promise<void> {
  const file = pendingFile.value
  if (!file)
    return
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
      message.value = 'Embedded Resource was rejected.'
  }
  catch (error) {
    setError(error, 'Embedded Resource creation failed.')
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
    message.value = 'Resource URL was rejected.'
  }
}

async function replaceEmbeddedResource(): Promise<void> {
  const resource = selectedResource.value
  const file = pendingFile.value
  if (!resource || resource.kind !== 'embedded' || !file)
    return
  if (!await props.commands.replaceEmbeddedResource(resource.id, {
    name: resourceName.value,
    fileName: file.name,
    mediaType: file.type || 'application/octet-stream',
    bytes: new Uint8Array(await file.arrayBuffer()),
  })) {
    message.value = 'Resource replacement was rejected.'
  }
}

function renameResource(): void {
  const resource = selectedResource.value
  if (resource && resource.name !== resourceName.value)
    props.commands.renameResource(resource.id, resourceName.value)
}

function removeResource(): void {
  const resource = selectedResource.value
  if (!resource)
    return
  if (props.commands.deleteResource(resource.id)) {
    selectedId.value = ''
    ensureSelection()
  }
  else {
    message.value = 'Resource is referenced and cannot be deleted.'
  }
}

async function exportResource(): Promise<void> {
  const resource = selectedResource.value
  const transfer = resource && await props.commands.exportResource(resource.id)
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
      message.value = 'Resource import was rejected.'
  }
  catch (error) {
    setError(error, 'Resource import failed.')
  }
  finally {
    resourceImport.value?.clearFiles()
  }
}
</script>

<template>
  <ElDialog :model-value="modelValue" width="min(960px, calc(100vw - 32px))" title="Assets" data-asset-manager @update:model-value="emit('update:modelValue', $event)">
    <div class="asset-manager">
      <aside class="asset-manager__list" data-asset-navigation>
        <div class="asset-manager__heading"><strong>Datasets</strong><ElButton text circle aria-label="New Dataset" @click="createDataset"><Plus :size="15" aria-hidden="true" /></ElButton></div>
        <ElButton v-for="dataset in datasets" :key="dataset.id" text :class="{ 'is-active': kind === 'dataset' && selectedId === dataset.id }" @click="select('dataset', dataset.id)">{{ dataset.name }}</ElButton>
        <div class="asset-manager__actions">
          <ElUpload ref="datasetImport" class="asset-manager__upload" data-asset-dataset-import-file accept="application/json,.json" :auto-upload="false" :show-file-list="false" :on-change="importDataset">
            <ElButton size="small" data-asset-dataset-import>Import</ElButton>
          </ElUpload>
          <ElButton size="small" data-asset-dataset-export :disabled="!selectedDataset" @click="exportDataset">Export</ElButton>
        </div>
        <div class="asset-manager__heading"><strong>Resources</strong><ElButton text circle aria-label="New URL Resource" @click="newUrlResource"><Plus :size="15" aria-hidden="true" /></ElButton></div>
        <ElButton v-for="resource in resources" :key="resource.id" text :class="{ 'is-active': kind === 'resource' && selectedId === resource.id }" @click="select('resource', resource.id)">{{ resource.name }}</ElButton>
        <div class="asset-manager__actions">
          <ElUpload ref="resourceImport" class="asset-manager__upload" data-asset-resource-import-file accept="application/json,.json" :auto-upload="false" :show-file-list="false" :on-change="importResource">
            <ElButton size="small" data-asset-resource-import>Import</ElButton>
          </ElUpload>
          <ElButton size="small" data-asset-resource-export :disabled="!selectedResource" @click="exportResource">Export</ElButton>
        </div>
        <div class="asset-manager__actions">
          <ElUpload ref="resourceFile" class="asset-manager__upload" data-asset-resource-file :auto-upload="false" :show-file-list="false" :on-change="selectResourceFile">
            <ElButton size="small" data-asset-resource-file-picker>Add file</ElButton>
          </ElUpload>
          <ElButton size="small" data-asset-resource-file-create :disabled="!pendingFile" @click="createEmbeddedResource">Create file</ElButton>
        </div>
        <ElSelect v-model="importStrategy" size="small" aria-label="Import conflict strategy"><ElOption label="Copy on conflict" value="copy" /><ElOption label="Overwrite on conflict" value="overwrite" /><ElOption label="Skip on conflict" value="skip" /></ElSelect>
      </aside>

      <section v-if="selectedDataset" class="asset-manager__editor" data-asset-dataset-editor>
        <div class="asset-manager__editor-header"><ElInput v-model="datasetName" aria-label="Dataset name" @change="renameDataset" /><ElButton type="danger" plain @click="removeDataset">Delete</ElButton></div>
        <ElTabs>
          <ElTabPane label="JSON">
            <ElInput v-model="datasetJson" class="asset-manager__json" data-asset-dataset-json type="textarea" :rows="18" aria-label="Dataset JSON" />
            <ElButton type="primary" data-asset-dataset-save @click="saveDatasetRows">Save JSON</ElButton>
          </ElTabPane>
          <ElTabPane label="Table">
            <ElTable :data="tableRows" data-asset-dataset-table size="small" max-height="380"><ElTableColumn v-for="column in tableColumns" :key="column" :label="column"><template #default="scope"><code>{{ typeof scope.row[column] === 'object' ? JSON.stringify(scope.row[column]) : scope.row[column] }}</code></template></ElTableColumn></ElTable>
          </ElTabPane>
        </ElTabs>
        <label class="asset-manager__label">Default projection</label>
        <ElInput v-model="projectionJson" class="asset-manager__projection" type="textarea" :rows="4" aria-label="Dataset default projection JSON" />
        <ElButton @click="saveProjection">Save projection</ElButton>
      </section>

      <section v-else-if="selectedResource" class="asset-manager__editor" data-asset-resource-editor>
        <div class="asset-manager__editor-header"><ElInput v-model="resourceName" aria-label="Resource name" @change="renameResource" /><ElButton type="danger" plain @click="removeResource">Delete</ElButton></div>
        <template v-if="selectedResource.kind === 'url'"><ElInput v-model="resourceUrl" aria-label="Resource URL" /><ElInput v-model="resourceMediaType" aria-label="Resource media type" placeholder="Media type" /><ElInput v-model="resourceIntegrity" aria-label="Resource integrity" placeholder="Integrity" /><ElButton type="primary" @click="saveUrlResource">Save URL</ElButton></template>
        <template v-else><dl class="asset-manager__metadata"><dt>File name</dt><dd>{{ selectedResource.fileName }}</dd><dt>Bytes</dt><dd>{{ selectedResource.byteLength }}</dd><dt>SHA-256</dt><dd>{{ selectedResource.contentHash }}</dd></dl><div class="asset-manager__actions"><ElUpload ref="resourceReplacementFile" class="asset-manager__upload" data-asset-resource-replacement-file :auto-upload="false" :show-file-list="false" :on-change="selectResourceFile"><ElButton>Choose replacement</ElButton></ElUpload><ElButton :disabled="!pendingFile" type="primary" @click="replaceEmbeddedResource">Replace file</ElButton></div></template>
      </section>

      <section v-else class="asset-manager__empty"><ElEmpty description="Select an asset, or create a Dataset / URL Resource." /><ElUpload ref="resourceEmptyFile" class="asset-manager__upload" data-asset-resource-empty-file :auto-upload="false" :show-file-list="false" :on-change="selectResourceFile"><ElButton>Choose file</ElButton></ElUpload><ElButton :disabled="!pendingFile" @click="createEmbeddedResource">Create embedded Resource</ElButton></section>
    </div>
    <p v-if="message" class="asset-manager__message" role="status">{{ message }}</p>
  </ElDialog>
</template>

<style scoped>
.asset-manager { display: grid; min-height: 500px; grid-template-columns: 210px minmax(0, 1fr); border: 1px solid var(--el-border-color); }
.asset-manager__list { display: grid; align-content: start; gap: 3px; padding: 10px; border-right: 1px solid var(--el-border-color); overflow: auto; }
.asset-manager__heading, .asset-manager__editor-header, .asset-manager__actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
.asset-manager__list > .el-button { justify-content: flex-start; margin: 0; }
.asset-manager__list > .el-button.is-active { background: var(--el-color-primary-light-9); }
.asset-manager__editor, .asset-manager__empty { display: grid; align-content: start; gap: 12px; padding: 16px; min-width: 0; }
.asset-manager__json :deep(textarea), .asset-manager__projection :deep(textarea) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.asset-manager__metadata { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 8px 12px; margin: 0; }
.asset-manager__metadata dd { margin: 0; overflow-wrap: anywhere; }
.asset-manager__label { font-size: 12px; color: var(--el-text-color-secondary); }
.asset-manager__upload :deep(.el-upload) { display: inline-flex; }
.asset-manager__message { margin: 10px 0 0; color: var(--el-color-danger); }
@media (max-width: 640px) { .asset-manager { grid-template-columns: 1fr; }.asset-manager__list { border-right: 0; border-bottom: 1px solid var(--el-border-color); }.asset-manager__editor { min-height: 0; } }
</style>
