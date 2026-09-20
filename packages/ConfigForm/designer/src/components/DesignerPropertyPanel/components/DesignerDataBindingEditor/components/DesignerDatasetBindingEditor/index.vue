<script setup lang="ts">
import type {
  DatasetProjection,
  DatasetReference,
  DatasetViewQuery,
  DatasetViewSortRule,
  DeepReadonly,
  MaterialDatasetBindingCapability,
  ModelJsonValue,
  ProjectDataset,
  SafeExpression,
  SurfaceNode,
} from '@moluoxixi/config-form-model'
import { Plus, Trash2 } from '@lucide/vue'
import {
  ElButton,
  ElCascader,
  ElInput,
  ElInputNumber,
  ElOption,
  ElSelect,
  ElSwitch,
} from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useDesignerLocale } from '../../../../../../locale'

interface DatasetPathOption {
  [key: string]: unknown
  children?: DatasetPathOption[]
  label: string
  value: string
}

const props = defineProps<{
  binding?: DeepReadonly<DatasetReference>
  capability: MaterialDatasetBindingCapability
  datasets: readonly DeepReadonly<ProjectDataset>[]
  hasInlineOptions: boolean
  node: SurfaceNode
  readonly: boolean
}>()

const emit = defineEmits<{
  apply: [reference: DatasetReference]
  materialize: []
  remove: []
  saveOptions: [name: string]
}>()

const locale = useDesignerLocale()
const cascaderProps = { checkStrictly: true, emitPath: true } as const
const datasetId = ref('')
const projection = ref<DatasetProjection>({ kind: 'options', labelPath: ['label'], valuePath: ['value'] })
const filterJson = ref('')
const sortRules = ref<DatasetViewSortRule[]>([])
const pageEnabled = ref(false)
const pageIndex = ref(0)
const pageSize = ref(10)
const optionsName = ref('')
const error = ref('')

const selectedDataset = computed(() => props.datasets.find(dataset => dataset.id === datasetId.value))
const pathOptions = computed(() => createPathOptions(selectedDataset.value?.rows ?? []))
const pathCandidates = computed(() => collectDatasetPaths(selectedDataset.value?.rows ?? []).leafPaths)

watch(
  [() => props.binding, () => props.datasets],
  () => syncBinding(),
  { deep: true, immediate: true },
)
watch(
  () => props.node.id,
  () => optionsName.value = defaultOptionsName(props.node),
  { immediate: true },
)

function syncBinding(): void {
  const binding = props.binding
  const firstDataset = props.datasets[0]
  datasetId.value = binding?.datasetId ?? firstDataset?.id ?? ''
  const dataset = props.datasets.find(candidate => candidate.id === datasetId.value)
  projection.value = binding
    ? cloneProjection(binding.projection)
    : projectionFor(dataset, props.capability.projectionKinds[0] ?? 'options')
  filterJson.value = binding?.query?.filter ? JSON.stringify(binding.query.filter, null, 2) : ''
  sortRules.value = binding?.query?.sort?.map(rule => ({ path: [...rule.path], direction: rule.direction })) ?? []
  pageEnabled.value = binding?.query?.page !== undefined
  pageIndex.value = binding?.query?.page?.index ?? 0
  pageSize.value = binding?.query?.page?.size ?? 10
  error.value = ''
}

function defaultOptionsName(node: SurfaceNode): string {
  const label = node.kind === 'field' ? node.label?.trim() || node.field : node.component
  return `${label} options`
}

function selectDataset(value: unknown): void {
  if (typeof value !== 'string')
    return
  datasetId.value = value
  const dataset = props.datasets.find(candidate => candidate.id === value)
  const kind = props.capability.projectionKinds.includes(projection.value.kind)
    ? projection.value.kind
    : props.capability.projectionKinds[0] ?? 'options'
  projection.value = projectionFor(dataset, kind)
  filterJson.value = ''
  sortRules.value = []
  pageEnabled.value = false
  pageIndex.value = 0
  pageSize.value = 10
  error.value = ''
}

function selectProjectionKind(value: unknown): void {
  if ((value !== 'options' && value !== 'table' && value !== 'list')
    || !props.capability.projectionKinds.includes(value)) {
    return
  }
  projection.value = projectionFor(selectedDataset.value, value)
  error.value = ''
}

function projectionFor(
  dataset: DeepReadonly<ProjectDataset> | undefined,
  kind: DatasetProjection['kind'],
): DatasetProjection {
  if (dataset?.defaultProjection?.kind === kind)
    return cloneProjection(dataset.defaultProjection)
  const { leafPaths } = collectDatasetPaths(dataset?.rows ?? [])
  const path = (preferred: string[], fallback: number, hardDefault: string[]) => {
    return leafPaths.find(candidate => preferred.includes(candidate.at(-1) ?? ''))
      ?? leafPaths[fallback]
      ?? hardDefault
  }
  if (kind === 'options') {
    const disabledPath = leafPaths.find(candidate => candidate.at(-1) === 'disabled')
    return {
      kind,
      labelPath: [...path(['label', 'name', 'title'], 0, ['label'])],
      valuePath: [...path(['value', 'id', 'key'], 1, ['value'])],
      ...(disabledPath ? { disabledPath: [...disabledPath] } : {}),
    }
  }
  if (kind === 'table') {
    const columnPaths = leafPaths.slice(0, 6)
    const usedKeys = new Set<string>()
    return {
      kind,
      rowKeyPath: [...path(['id', 'key', 'value'], 0, ['id'])],
      columns: (columnPaths.length ? columnPaths : [['label']]).map((valuePath, index) => ({
        key: uniqueColumnKey(valuePath.at(-1) || `column${index + 1}`, usedKeys),
        valuePath: [...valuePath],
      })),
    }
  }
  const titlePath = path(['title', 'name', 'label'], 0, ['title'])
  const descriptionPath = leafPaths.find(candidate => ['description', 'summary', 'subtitle'].includes(candidate.at(-1) ?? ''))
  return {
    kind,
    itemKeyPath: [...path(['id', 'key', 'value'], 0, ['id'])],
    titlePath: [...titlePath],
    ...(descriptionPath ? { descriptionPath: [...descriptionPath] } : {}),
  }
}

function uniqueColumnKey(source: string, used: Set<string>): string {
  const base = source.trim() || 'column'
  let key = base
  let index = 2
  while (used.has(key))
    key = `${base}-${index++}`
  used.add(key)
  return key
}

function cloneProjection(value: DeepReadonly<DatasetProjection>): DatasetProjection {
  if (value.kind === 'options') {
    return {
      kind: value.kind,
      labelPath: [...value.labelPath],
      valuePath: [...value.valuePath],
      ...(value.disabledPath ? { disabledPath: [...value.disabledPath] } : {}),
    }
  }
  if (value.kind === 'table') {
    return {
      kind: value.kind,
      rowKeyPath: [...value.rowKeyPath],
      columns: value.columns.map(column => ({ key: column.key, valuePath: [...column.valuePath] })),
    }
  }
  return {
    kind: value.kind,
    itemKeyPath: [...value.itemKeyPath],
    ...(value.titlePath ? { titlePath: [...value.titlePath] } : {}),
    ...(value.descriptionPath ? { descriptionPath: [...value.descriptionPath] } : {}),
  }
}

function normalizePath(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.some(segment => typeof segment !== 'string' || !segment))
    return undefined
  return [...value]
}

function updateOptionsPath(key: 'disabledPath' | 'labelPath' | 'valuePath', value: unknown): void {
  if (projection.value.kind !== 'options')
    return
  const path = normalizePath(value)
  if (!path && key !== 'disabledPath')
    return
  projection.value = {
    ...projection.value,
    ...(path ? { [key]: path } : {}),
  }
  if (!path && key === 'disabledPath')
    delete projection.value.disabledPath
}

function updateListPath(key: 'descriptionPath' | 'itemKeyPath' | 'titlePath', value: unknown): void {
  if (projection.value.kind !== 'list')
    return
  const path = normalizePath(value)
  if (!path && key === 'itemKeyPath')
    return
  projection.value = {
    ...projection.value,
    ...(path ? { [key]: path } : {}),
  }
  if (!path && key !== 'itemKeyPath')
    delete projection.value[key]
}

function updateTableRowKey(value: unknown): void {
  if (projection.value.kind !== 'table')
    return
  const path = normalizePath(value)
  if (path)
    projection.value = { ...projection.value, rowKeyPath: path }
}

function addColumn(): void {
  const table = projection.value
  if (table.kind !== 'table')
    return
  const used = new Set(table.columns.map(column => column.key))
  const valuePath = pathCandidates.value.find(path => !table.columns.some(column => pathsEqual(column.valuePath, path)))
    ?? pathCandidates.value[0]
    ?? ['value']
  projection.value = {
    ...table,
    columns: [...table.columns, {
      key: uniqueColumnKey(valuePath.at(-1) || 'column', used),
      valuePath: [...valuePath],
    }],
  }
}

function updateColumn(index: number, changes: { key?: string, valuePath?: string[] }): void {
  if (projection.value.kind !== 'table')
    return
  projection.value = {
    ...projection.value,
    columns: projection.value.columns.map((column, columnIndex) => columnIndex === index
      ? { ...column, ...changes }
      : column),
  }
}

function removeColumn(index: number): void {
  if (projection.value.kind === 'table' && projection.value.columns.length > 1) {
    projection.value = {
      ...projection.value,
      columns: projection.value.columns.filter((_, columnIndex) => columnIndex !== index),
    }
  }
}

function addSortRule(): void {
  sortRules.value = [...sortRules.value, {
    path: [...(pathCandidates.value[0] ?? ['id'])],
    direction: 'asc',
  }]
}

function updateSortRule(index: number, changes: Partial<DatasetViewSortRule>): void {
  sortRules.value = sortRules.value.map((rule, ruleIndex) => ruleIndex === index
    ? { ...rule, ...changes }
    : rule)
}

function removeSortRule(index: number): void {
  sortRules.value = sortRules.value.filter((_, ruleIndex) => ruleIndex !== index)
}

function apply(): void {
  if (!datasetId.value) {
    error.value = locale.t('data.dataset.required', 'Select a Dataset first.')
    return
  }
  const projectionError = validateProjection(projection.value)
  if (projectionError) {
    error.value = projectionError
    return
  }
  let filter: SafeExpression | undefined
  try {
    filter = filterJson.value.trim()
      ? JSON.parse(filterJson.value) as SafeExpression
      : undefined
  }
  catch {
    error.value = locale.t('data.query.filterInvalid', 'Filter expression JSON is invalid.')
    return
  }
  const query: DatasetViewQuery = {
    ...(filter ? { filter } : {}),
    ...(sortRules.value.length
      ? { sort: sortRules.value.map(rule => ({ path: [...rule.path], direction: rule.direction })) }
      : {}),
    ...(pageEnabled.value ? { page: { index: pageIndex.value, size: pageSize.value } } : {}),
  }
  error.value = ''
  emit('apply', {
    datasetId: datasetId.value,
    projection: cloneProjection(projection.value),
    ...(Object.keys(query).length ? { query } : {}),
  })
}

function validateProjection(value: DatasetProjection): string | undefined {
  if (value.kind === 'options' && (!value.labelPath.length || !value.valuePath.length))
    return locale.t('data.projection.pathRequired', 'Projection paths are required.')
  if (value.kind === 'table') {
    if (!value.rowKeyPath.length || value.columns.length === 0
      || value.columns.some(column => !column.key.trim() || !column.valuePath.length)) {
      return locale.t('data.projection.tableInvalid', 'A row key and at least one complete column are required.')
    }
    if (new Set(value.columns.map(column => column.key)).size !== value.columns.length)
      return locale.t('data.projection.columnDuplicate', 'Table column keys must be unique.')
  }
  if (value.kind === 'list' && !value.itemKeyPath.length)
    return locale.t('data.projection.pathRequired', 'Projection paths are required.')
}

function saveOptions(): void {
  const name = optionsName.value.trim()
  if (!name) {
    error.value = locale.t('data.options.nameRequired', 'Enter a Dataset name.')
    return
  }
  error.value = ''
  emit('saveOptions', name)
}

function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index])
}

function collectDatasetPaths(rows: readonly DeepReadonly<Record<string, ModelJsonValue>>[]): {
  allPaths: string[][]
  leafPaths: string[][]
} {
  const all = new Map<string, string[]>()
  const leaves = new Map<string, string[]>()
  const visit = (value: unknown, path: string[], depth: number): void => {
    if (depth > 8 || !value || typeof value !== 'object')
      return
    Object.entries(value).forEach(([key, child]) => {
      if (!key || ['__proto__', 'constructor', 'prototype'].includes(key))
        return
      const next = [...path, key]
      const identity = JSON.stringify(next)
      all.set(identity, next)
      if (child && typeof child === 'object')
        visit(child, next, depth + 1)
      else
        leaves.set(identity, next)
    })
  }
  rows.forEach(row => visit(row, [], 0))
  return { allPaths: [...all.values()], leafPaths: [...leaves.values()] }
}

function createPathOptions(rows: readonly DeepReadonly<Record<string, ModelJsonValue>>[]): DatasetPathOption[] {
  const root: DatasetPathOption[] = []
  collectDatasetPaths(rows).allPaths.forEach((path) => {
    let level = root
    path.forEach((segment, index) => {
      let option = level.find(candidate => candidate.value === segment)
      if (!option) {
        option = { label: segment, value: segment }
        level.push(option)
        level.sort((left, right) => left.label.localeCompare(right.label))
      }
      if (index < path.length - 1) {
        option.children ??= []
        level = option.children
      }
    })
  })
  return root
}
</script>

<template>
  <section class="mx-config-form-designer__data-binding-section" :data-dataset-binding="capability.key">
    <div class="mx-config-form-designer__data-binding-title">
      <strong>{{ locale.t('data.dataset.title', 'Dataset') }}</strong>
      <code>{{ capability.key }}</code>
    </div>

    <template v-if="hasInlineOptions && !binding">
      <div class="mx-config-form-designer__data-binding-field">
        <label>{{ locale.t('data.options.datasetName', 'Dataset name') }}</label>
        <ElInput v-model="optionsName" :disabled="readonly" :aria-label="locale.t('data.options.datasetName', 'Dataset name')" />
      </div>
      <ElButton size="small" :disabled="readonly" data-save-options-dataset @click="saveOptions">
        {{ locale.t('data.options.save', 'Save inline options as Dataset') }}
      </ElButton>
    </template>

    <template v-if="datasets.length">
      <div class="mx-config-form-designer__data-binding-field">
        <label>{{ locale.t('data.dataset.asset', 'Dataset') }}</label>
        <ElSelect
          :model-value="datasetId"
          :disabled="readonly"
          filterable
          :aria-label="locale.t('data.dataset.asset', 'Dataset')"
          data-dataset-select
          @update:model-value="selectDataset"
        >
          <ElOption v-for="dataset in datasets" :key="dataset.id" :value="dataset.id" :label="dataset.name" />
        </ElSelect>
      </div>

      <div v-if="capability.projectionKinds.length > 1" class="mx-config-form-designer__data-binding-field">
        <label>{{ locale.t('data.projection.kind', 'Projection') }}</label>
        <ElSelect
          :model-value="projection.kind"
          :disabled="readonly"
          :aria-label="locale.t('data.projection.kind', 'Projection')"
          data-projection-kind
          @update:model-value="selectProjectionKind"
        >
          <ElOption v-for="kind in capability.projectionKinds" :key="kind" :value="kind" :label="kind" />
        </ElSelect>
      </div>

      <div v-if="projection.kind === 'options'" class="mx-config-form-designer__data-binding-fields" data-options-projection>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.labelPath', 'Label path') }}</label>
          <ElCascader :model-value="projection.labelPath" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.projection.labelPath', 'Label path')" @change="updateOptionsPath('labelPath', $event)" />
        </div>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.valuePath', 'Value path') }}</label>
          <ElCascader :model-value="projection.valuePath" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.projection.valuePath', 'Value path')" @change="updateOptionsPath('valuePath', $event)" />
        </div>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.disabledPath', 'Disabled path') }}</label>
          <ElCascader :model-value="projection.disabledPath" :options="pathOptions" :props="cascaderProps" filterable clearable :disabled="readonly" :aria-label="locale.t('data.projection.disabledPath', 'Disabled path')" @change="updateOptionsPath('disabledPath', $event)" />
        </div>
      </div>

      <div v-else-if="projection.kind === 'table'" class="mx-config-form-designer__data-binding-fields" data-table-projection>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.rowKeyPath', 'Row key path') }}</label>
          <ElCascader :model-value="projection.rowKeyPath" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.projection.rowKeyPath', 'Row key path')" @change="updateTableRowKey" />
        </div>
        <div class="mx-config-form-designer__data-binding-list">
          <div class="mx-config-form-designer__data-binding-row-heading">
            <label>{{ locale.t('data.projection.columns', 'Columns') }}</label>
            <ElButton text circle :disabled="readonly" :aria-label="locale.t('data.projection.addColumn', 'Add column')" @click="addColumn"><Plus :size="14" aria-hidden="true" /></ElButton>
          </div>
          <div v-for="(column, index) in projection.columns" :key="index" class="mx-config-form-designer__data-binding-row">
            <div class="mx-config-form-designer__data-binding-field">
              <label>{{ locale.t('data.projection.columnKey', 'Column key') }}</label>
              <ElInput :model-value="column.key" :disabled="readonly" :aria-label="locale.t('data.projection.columnKey', 'Column key')" @update:model-value="updateColumn(index, { key: $event })" />
            </div>
            <div class="mx-config-form-designer__data-binding-field">
              <label>{{ locale.t('data.projection.columnPath', 'Value path') }}</label>
              <ElCascader :model-value="column.valuePath" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.projection.columnPath', 'Value path')" @change="updateColumn(index, { valuePath: normalizePath($event) ?? column.valuePath })" />
            </div>
            <ElButton text circle :disabled="readonly || projection.columns.length === 1" :aria-label="locale.t('data.projection.removeColumn', 'Remove column')" @click="removeColumn(index)"><Trash2 :size="14" aria-hidden="true" /></ElButton>
          </div>
        </div>
      </div>

      <div v-else class="mx-config-form-designer__data-binding-fields" data-list-projection>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.itemKeyPath', 'Item key path') }}</label>
          <ElCascader :model-value="projection.itemKeyPath" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.projection.itemKeyPath', 'Item key path')" @change="updateListPath('itemKeyPath', $event)" />
        </div>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.titlePath', 'Title path') }}</label>
          <ElCascader :model-value="projection.titlePath" :options="pathOptions" :props="cascaderProps" filterable clearable :disabled="readonly" :aria-label="locale.t('data.projection.titlePath', 'Title path')" @change="updateListPath('titlePath', $event)" />
        </div>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.projection.descriptionPath', 'Description path') }}</label>
          <ElCascader :model-value="projection.descriptionPath" :options="pathOptions" :props="cascaderProps" filterable clearable :disabled="readonly" :aria-label="locale.t('data.projection.descriptionPath', 'Description path')" @change="updateListPath('descriptionPath', $event)" />
        </div>
      </div>

      <div class="mx-config-form-designer__data-binding-field">
        <label>{{ locale.t('data.query.filter', 'Filter expression JSON') }}</label>
        <ElInput v-model="filterJson" class="mx-config-form-designer__data-binding-filter" type="textarea" :rows="3" :disabled="readonly" :aria-label="locale.t('data.query.filter', 'Filter expression JSON')" />
      </div>

      <div class="mx-config-form-designer__data-binding-list" data-query-sort>
        <div class="mx-config-form-designer__data-binding-row-heading">
          <label>{{ locale.t('data.query.sort', 'Local sort') }}</label>
          <ElButton text circle :disabled="readonly" :aria-label="locale.t('data.query.addSort', 'Add sort rule')" @click="addSortRule"><Plus :size="14" aria-hidden="true" /></ElButton>
        </div>
        <div v-for="(rule, index) in sortRules" :key="index" class="mx-config-form-designer__data-binding-row">
          <div class="mx-config-form-designer__data-binding-field">
            <label>{{ locale.t('data.query.sortPath', 'Sort path') }}</label>
            <ElCascader :model-value="rule.path" :options="pathOptions" :props="cascaderProps" filterable :disabled="readonly" :aria-label="locale.t('data.query.sortPath', 'Sort path')" @change="updateSortRule(index, { path: normalizePath($event) ?? rule.path })" />
          </div>
          <div class="mx-config-form-designer__data-binding-field">
            <label>{{ locale.t('data.query.direction', 'Direction') }}</label>
            <ElSelect :model-value="rule.direction" :disabled="readonly" :aria-label="locale.t('data.query.direction', 'Direction')" @update:model-value="updateSortRule(index, { direction: $event })">
              <ElOption value="asc" :label="locale.t('data.query.asc', 'Ascending')" />
              <ElOption value="desc" :label="locale.t('data.query.desc', 'Descending')" />
            </ElSelect>
          </div>
          <ElButton text circle :disabled="readonly" :aria-label="locale.t('data.query.removeSort', 'Remove sort rule')" @click="removeSortRule(index)"><Trash2 :size="14" aria-hidden="true" /></ElButton>
        </div>
      </div>

      <div class="mx-config-form-designer__data-binding-field">
        <label>{{ locale.t('data.query.pagination', 'Local pagination') }}</label>
        <ElSwitch v-model="pageEnabled" :disabled="readonly" :aria-label="locale.t('data.query.pagination', 'Local pagination')" />
      </div>
      <div v-if="pageEnabled" class="mx-config-form-designer__data-binding-row" data-query-page>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.query.pageIndex', 'Page index') }}</label>
          <ElInputNumber v-model="pageIndex" :min="0" :precision="0" :disabled="readonly" :aria-label="locale.t('data.query.pageIndex', 'Page index')" />
        </div>
        <div class="mx-config-form-designer__data-binding-field">
          <label>{{ locale.t('data.query.pageSize', 'Page size') }}</label>
          <ElInputNumber v-model="pageSize" :min="1" :precision="0" :disabled="readonly" :aria-label="locale.t('data.query.pageSize', 'Page size')" />
        </div>
      </div>

      <div class="mx-config-form-designer__data-binding-actions">
        <ElButton type="primary" size="small" :disabled="readonly" data-apply-dataset-binding @click="apply">
          {{ binding ? locale.t('data.dataset.update', 'Update binding') : locale.t('data.dataset.bind', 'Bind Dataset') }}
        </ElButton>
        <ElButton v-if="binding?.projection.kind === 'options'" size="small" :disabled="readonly" data-materialize-options @click="emit('materialize')">
          {{ locale.t('data.options.materialize', 'Detach as inline options') }}
        </ElButton>
        <ElButton v-else-if="binding" size="small" :disabled="readonly" data-remove-dataset-binding @click="emit('remove')">
          {{ locale.t('data.dataset.remove', 'Remove binding') }}
        </ElButton>
      </div>
    </template>
    <p v-else class="mx-config-form-designer__data-binding-empty">
      {{ locale.t('data.dataset.empty', 'No Dataset is available.') }}
    </p>

    <p v-if="error" class="mx-config-form-designer__data-binding-error" role="alert">{{ error }}</p>
  </section>
</template>
