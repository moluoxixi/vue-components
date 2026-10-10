<script setup lang="ts">
import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import type { DatasetCellAddress, DatasetTableSort } from '../../../types'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Search, Trash2, WrapText, X } from '@lucide/vue'
import { createDatasetFromRows } from '@moluoxixi/config-form-model'
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { compareDatasetCells, datasetCellKind, describeDatasetColumns, formatDatasetCell, parseDatasetCell } from '../../../services'

const props = defineProps<{ json: string, locale: string }>()
const emit = defineEmits<{ 'update:json': [value: string], 'save': [] }>()
const chinese = computed(() => props.locale === 'zh-CN')
const query = ref('')
const columnName = ref('')
const addingColumn = ref(false)
const wrap = ref(false)
const page = ref(1)
const size = ref(25)
const error = ref('')
const selected = ref<DatasetCellAddress>()
const editing = ref(false)
const copied = ref(false)
const sort = ref<DatasetTableSort>()
const cellId = useId()
const cellInput = useTemplateRef<{ focus: () => void }>('cell-input')
const tableScroll = useTemplateRef<HTMLDivElement>('table-scroll')
const cellDrafts = defineModel<Record<string, string>>('cells', { default: () => ({}) })
let lastCommitted = ''
let selectionTimer: ReturnType<typeof setTimeout> | undefined

onBeforeUnmount(() => clearTimeout(selectionTimer))

const parsed = computed(() => {
  try {
    const result = createDatasetFromRows({ id: 'table-draft', name: 'Table draft', rows: JSON.parse(props.json) })
    if (!result.success)
      throw new TypeError(result.diagnostics[0]?.message ?? 'Invalid rows')
    return { rows: result.data.rows, error: '' }
  }
  catch (value) {
    return { rows: [] as ModelJsonObject[], error: value instanceof Error ? value.message : String(value) }
  }
})
const rows = computed(() => parsed.value.rows)
const columns = computed(() => describeDatasetColumns(rows.value))
const tableWidth = computed(() => columns.value.reduce((width, column) => width + column.width, 96))
const modified = computed(() => Object.keys(cellDrafts.value).length)
const typeLabels = computed(() => chinese.value
  ? { text: '文本', number: '数字', boolean: '布尔', object: '对象', array: '数组', null: '空值', missing: '未设置', mixed: '混合类型' }
  : { text: 'Text', number: 'Number', boolean: 'Boolean', object: 'Object', array: 'Array', null: 'Null', missing: 'Not set', mixed: 'Mixed' })

function cellKey(index: number, key: string): string {
  return JSON.stringify([index, key])
}
function cell(index: number, key: string): { value: ModelJsonValue | undefined, error: string } {
  const previous = rows.value[index]?.[key]
  const draft = cellDrafts.value[cellKey(index, key)]
  if (draft === undefined)
    return { value: previous, error: '' }
  try {
    return { value: parseDatasetCell(draft, previous), error: '' }
  }
  catch {
    const message = typeof previous === 'number'
      ? (chinese.value ? '请输入有效数字' : 'Enter a finite number')
      : typeof previous === 'boolean'
        ? (chinese.value ? '请输入 true 或 false' : 'Enter true or false')
        : (chinese.value ? '请输入有效 JSON' : 'Enter valid JSON')
    return { value: draft, error: message }
  }
}
function cellLabel(index: number, key: string): string {
  const value = cell(index, key).value
  if (value === undefined)
    return chinese.value ? '未设置' : 'Not set'
  if (value === '')
    return chinese.value ? '空字符串' : 'Empty string'
  return formatDatasetCell(value)
}
function hasDraft(index: number, key: string): boolean {
  return Object.hasOwn(cellDrafts.value, cellKey(index, key))
}

const filtered = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  const entries = rows.value.map((row, index) => ({ row, index })).filter(entry => !term || columns.value.some(column =>
    formatDatasetCell(cell(entry.index, column.key).value).toLocaleLowerCase().includes(term),
  ))
  const order = sort.value
  return order
    ? entries.sort((left, right) => compareDatasetCells(cell(left.index, order.key).value, cell(right.index, order.key).value, order.direction, props.locale) || left.index - right.index)
    : entries
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))
const visible = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))
const rangeStart = computed(() => filtered.value.length ? (page.value - 1) * size.value + 1 : 0)
const rangeEnd = computed(() => Math.min(page.value * size.value, filtered.value.length))
const selectedCell = computed(() => selected.value ? cell(selected.value.index, selected.value.key) : undefined)
const selectedKind = computed(() => datasetCellKind(selectedCell.value?.value))
const selectedContent = computed(() => selectedCell.value ? formatDatasetCell(selectedCell.value.value, true) : '')
const editContent = computed(() => selected.value
  ? cellDrafts.value[cellKey(selected.value.index, selected.value.key)] ?? formatDatasetCell(rows.value[selected.value.index]?.[selected.value.key], true)
  : '')

watch([query, size, sort], () => {
  page.value = 1
})
watch(pages, () => {
  page.value = Math.min(page.value, pages.value)
})
watch(page, () => {
  tableScroll.value?.scrollTo({ top: 0 })
})
watch(() => props.json, (value) => {
  if (value !== lastCommitted) {
    clearTimeout(selectionTimer)
    cellDrafts.value = {}
    selected.value = undefined
    editing.value = false
  }
})
watch(columns, (value) => {
  if (sort.value && !value.some(column => column.key === sort.value?.key))
    sort.value = undefined
})

function commit(next: ModelJsonObject[]): void {
  lastCommitted = JSON.stringify(next, null, 2)
  emit('update:json', lastCommitted)
  error.value = ''
}
function draftCell(input: string | number): void {
  if (!selected.value)
    return
  const { index, key } = selected.value
  const address = cellKey(index, key)
  const previous = rows.value[index]?.[key]
  const text = String(input)
  let unchanged = text === formatDatasetCell(previous)
  try {
    unchanged ||= JSON.stringify(parseDatasetCell(text, previous)) === JSON.stringify(previous)
  }
  catch { /* Keep invalid input in the draft so it can be corrected. */ }
  if (unchanged)
    delete cellDrafts.value[address]
  else
    cellDrafts.value[address] = text
  copied.value = false
  error.value = ''
}
function applyDrafts(): ModelJsonObject[] | undefined {
  const next = structuredClone(rows.value)
  try {
    for (const [address, input] of Object.entries(cellDrafts.value)) {
      const [index, key] = JSON.parse(address) as [number, string]
      const resolved = cell(index, key)
      if (resolved.error)
        throw new TypeError(`${index + 1} / ${key}: ${resolved.error}`)
      next[index]![key] = parseDatasetCell(input, rows.value[index]?.[key])
    }
    const checked = createDatasetFromRows({ id: 'table-draft', name: 'Table draft', rows: next })
    if (!checked.success)
      throw new TypeError(checked.diagnostics[0]?.message ?? 'Invalid rows')
    cellDrafts.value = {}
    return checked.data.rows
  }
  catch (value) {
    error.value = value instanceof Error ? value.message : String(value)
  }
}
async function save(): Promise<void> {
  const next = applyDrafts()
  if (!next)
    return
  editing.value = false
  commit(next)
  await nextTick()
  emit('save')
}
async function addRow(): Promise<void> {
  const next = applyDrafts()
  if (!next)
    return
  next.push(Object.fromEntries(columns.value.map(column => [column.key, ''])))
  commit(next)
  query.value = ''
  sort.value = undefined
  await nextTick()
  page.value = Math.ceil(next.length / size.value)
}
function removeRow(index: number): void {
  const next = applyDrafts()
  if (next) {
    selected.value = undefined
    editing.value = false
    commit(next.filter((_, rowIndex) => rowIndex !== index))
  }
}
function removeColumn(key: string): void {
  const next = applyDrafts()
  if (next) {
    if (selected.value?.key === key)
      selected.value = undefined
    commit(next.map((row) => {
      delete row[key]
      return row
    }))
  }
}
function addColumn(): void {
  const key = columnName.value.trim()
  if (!key || columns.value.some(column => column.key === key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
    error.value = chinese.value ? '请输入不重复的安全列名' : 'Enter a unique, safe column name'
    return
  }
  const next = applyDrafts()
  if (!next)
    return
  commit((next.length ? next : [{}]).map(row => ({ ...row, [key]: '' })))
  columnName.value = ''
  addingColumn.value = false
}
function toggleSort(key: string): void {
  sort.value = sort.value?.key !== key
    ? { key, direction: 'ascending' }
    : sort.value.direction === 'ascending' ? { key, direction: 'descending' } : undefined
}
function handleCellClick(event: MouseEvent, index: number, key: string): void {
  clearTimeout(selectionTimer)
  // Wait for a possible double-click before the inspector changes the table width.
  if (event.detail === 0 || ('pointerType' in event && event.pointerType === 'touch')) {
    void selectCell(index, key)
  }
  else {
    selectionTimer = setTimeout(() => {
      void selectCell(index, key)
    }, 250)
  }
}
async function selectCell(index: number, key: string, edit = false): Promise<void> {
  clearTimeout(selectionTimer)
  selected.value = { index, key }
  editing.value = edit
  copied.value = false
  await nextTick()
  const viewport = tableScroll.value
  const button = Array.from(viewport?.querySelectorAll<HTMLButtonElement>('[data-dataset-cell]') ?? [])
    .find(button => button.dataset.datasetCell === cellKey(index, key))
  if (viewport && button) {
    const bounds = viewport.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    if (target.right > bounds.right - 44)
      viewport.scrollLeft += target.right - bounds.right + 44
    else if (target.left < bounds.left + 52)
      viewport.scrollLeft -= bounds.left + 52 - target.left
  }
  if (edit) {
    cellInput.value?.focus()
  }
}
function resetCell(): void {
  if (selected.value)
    delete cellDrafts.value[cellKey(selected.value.index, selected.value.key)]
  error.value = ''
}
async function copyCell(): Promise<void> {
  try {
    await navigator.clipboard.writeText(selectedContent.value)
    copied.value = true
  }
  catch {
    error.value = chinese.value ? '无法复制，请选中完整内容后手动复制。' : 'Select the full value and copy it manually.'
  }
}
function handleCellKeydown(event: KeyboardEvent, index: number, key: string): void {
  if (event.key === 'F2') {
    event.preventDefault()
    void selectCell(index, key, true)
    return
  }
  const deltas: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  const delta = deltas[event.key]
  if (!delta)
    return
  event.preventDefault()
  const row = visible.value[visible.value.findIndex(entry => entry.index === index) + delta[0]]
  const column = columns.value[columns.value.findIndex(column => column.key === key) + delta[1]]
  if (!row || !column)
    return
  const address = cellKey(row.index, column.key)
  Array.from(tableScroll.value?.querySelectorAll<HTMLButtonElement>('[data-dataset-cell]') ?? [])
    .find(button => button.dataset.datasetCell === address)
    ?.focus()
}
</script>

<template>
  <section class="dataset-table-editor">
    <p v-if="parsed.error" class="dataset-editor-error" role="alert">
      {{ parsed.error }} · {{ chinese ? '请在 JSON 页修正草稿。' : 'Correct the draft in the JSON tab.' }}
    </p>
    <template v-else>
      <div class="dataset-table-overview">
        <div><strong>{{ rows.length.toLocaleString() }}</strong> {{ chinese ? '行数据' : 'rows' }}<span>·</span><strong>{{ columns.length }}</strong> {{ chinese ? '列' : 'columns' }}</div>
        <span v-if="modified" class="dataset-table-changes" role="status">{{ chinese ? `${modified} 格已修改，尚未保存` : `${modified} edited cells · unsaved` }}</span>
      </div>
      <div class="dataset-table-toolbar">
        <div class="dataset-table-search">
          <Search :size="15" aria-hidden="true" />
          <ElInput v-model="query" clearable :aria-label="chinese ? '筛选数据行' : 'Filter rows'" :placeholder="chinese ? '搜索所有列的内容…' : 'Search across all columns…'" />
        </div>
        <ElButton :aria-pressed="wrap" :class="{ 'is-active': wrap }" @click="wrap = !wrap">
          <WrapText :size="15" aria-hidden="true" />{{ chinese ? '文本换行' : 'Wrap text' }}
        </ElButton>
        <ElButton @click="addRow">
          <Plus :size="15" aria-hidden="true" />{{ chinese ? '添加行' : 'Add row' }}
        </ElButton>
        <ElButton :aria-expanded="addingColumn" @click="addingColumn = !addingColumn">
          <Plus :size="15" aria-hidden="true" />{{ chinese ? '添加列' : 'Add column' }}
        </ElButton>
      </div>
      <form v-if="addingColumn" class="dataset-column-form" @submit.prevent="addColumn">
        <ElInput v-model="columnName" :aria-label="chinese ? '新列名' : 'New column name'" :placeholder="chinese ? '输入新列名' : 'Enter a column name'" />
        <ElButton type="primary" native-type="submit">
          {{ chinese ? '确认添加' : 'Confirm column' }}
        </ElButton>
        <ElButton :aria-label="chinese ? '取消添加列' : 'Cancel column'" @click="addingColumn = false">
          <X :size="14" />
        </ElButton>
      </form>
      <p class="dataset-table-instructions">
        {{ chinese ? '单击查看完整内容 · 双击或 F2 编辑 · 点击列名排序' : 'Click to read the full value · Double-click or F2 to edit · Click a column name to sort' }}
      </p>
      <p v-if="error" class="dataset-editor-error" role="alert">
        {{ error }}
      </p>
      <div class="dataset-table-workspace" :class="{ 'has-detail': selected }">
        <div ref="table-scroll" class="dataset-table-scroll" :class="{ 'is-wrapped': wrap }" data-asset-dataset-table tabindex="0" role="region" :aria-label="chinese ? '数据行' : 'Dataset rows'">
          <table :style="{ width: `${tableWidth}px` }">
            <caption class="dataset-table-caption">
              {{ chinese ? '数据集内容' : 'Dataset contents' }}
            </caption>
            <colgroup><col style="width: 52px"><col v-for="column in columns" :key="column.key" :style="{ width: `${column.width}px` }"><col style="width: 44px"></colgroup>
            <thead>
              <tr>
                <th class="dataset-row-number" scope="col" :aria-label="chinese ? '原始行号' : 'Original row number'">
                  #
                </th>
                <th v-for="column in columns" :key="column.key" scope="col" :aria-sort="sort?.key === column.key ? sort.direction : 'none'" :class="{ 'is-selected': selected?.key === column.key }">
                  <div class="dataset-column-heading">
                    <button type="button" class="dataset-column-sort" :aria-label="chinese ? `按 ${column.key} 排序` : `Sort by ${column.key}`" @click="toggleSort(column.key)">
                      <span :title="column.key">{{ column.key }}</span>
                      <ArrowUp v-if="sort?.key === column.key && sort.direction === 'ascending'" :size="14" aria-hidden="true" />
                      <ArrowDown v-else-if="sort?.key === column.key" :size="14" aria-hidden="true" />
                      <ArrowUpDown v-else :size="13" class="dataset-sort-idle" aria-hidden="true" />
                    </button>
                    <button type="button" class="dataset-column-delete" :aria-label="chinese ? `删除列 ${column.key}` : `Delete column ${column.key}`" @click="removeColumn(column.key)">
                      <Trash2 :size="13" aria-hidden="true" />
                    </button>
                  </div>
                  <span class="dataset-column-type">{{ typeLabels[column.kind] }}</span>
                </th>
                <th scope="col" class="dataset-row-actions">
                  <span class="dataset-table-caption">{{ chinese ? '行操作' : 'Row actions' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in visible" :key="entry.index" :class="{ 'is-selected': selected?.index === entry.index }">
                <th scope="row" class="dataset-row-number">
                  {{ entry.index + 1 }}
                </th>
                <td v-for="(column, columnIndex) in columns" :key="column.key" :class="{ 'is-edited': hasDraft(entry.index, column.key), 'has-error': cell(entry.index, column.key).error, 'is-selected': selected?.index === entry.index && selected.key === column.key }" :data-cell-kind="datasetCellKind(cell(entry.index, column.key).value)">
                  <button type="button" class="dataset-cell" :data-dataset-cell="cellKey(entry.index, column.key)" :aria-label="`${entry.index + 1} / ${column.key}`" :aria-describedby="`${cellId}-${entry.index}-${columnIndex}`" :aria-pressed="selected?.index === entry.index && selected.key === column.key" @click="handleCellClick($event, entry.index, column.key)" @dblclick="selectCell(entry.index, column.key, true)" @keydown="handleCellKeydown($event, entry.index, column.key)">
                    <span :id="`${cellId}-${entry.index}-${columnIndex}`" class="dataset-cell-value" :class="{ 'is-empty': cell(entry.index, column.key).value === '' }">{{ cellLabel(entry.index, column.key) }}</span>
                    <span v-if="hasDraft(entry.index, column.key)" class="dataset-cell-draft" :title="chinese ? '未保存修改' : 'Unsaved edit'" aria-hidden="true" />
                  </button>
                </td>
                <td class="dataset-row-actions">
                  <button type="button" :aria-label="chinese ? `删除第 ${entry.index + 1} 行` : `Delete row ${entry.index + 1}`" @click="removeRow(entry.index)">
                    <Trash2 :size="14" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="!visible.length" class="dataset-table-empty">
            <Search v-if="query" :size="24" aria-hidden="true" />
            <strong>{{ query ? (chinese ? '没有匹配的数据' : 'No matching rows') : (chinese ? '还没有数据' : 'No rows yet') }}</strong>
            <span>{{ query ? (chinese ? '尝试其他关键词，或清除筛选。' : 'Try another term or clear the filter.') : (chinese ? '添加行，或从「导入数据」开始。' : 'Add a row or open Import data.') }}</span>
            <ElButton v-if="query" @click="query = ''">
              {{ chinese ? '清除筛选' : 'Clear filter' }}
            </ElButton>
          </div>
        </div>
        <aside v-if="selected" class="dataset-cell-detail" data-dataset-cell-detail :aria-label="chinese ? '单元格详情' : 'Cell details'">
          <header>
            <div><span>{{ chinese ? `第 ${selected.index + 1} 行` : `Row ${selected.index + 1}` }}</span><strong>{{ selected.key }}</strong></div>
            <button type="button" :aria-label="chinese ? '关闭单元格详情' : 'Close cell details'" @click="selected = undefined">
              <X :size="16" aria-hidden="true" />
            </button>
          </header>
          <div class="dataset-cell-detail-meta">
            <span>{{ typeLabels[selectedKind] }}</span><span v-if="hasDraft(selected.index, selected.key)" class="dataset-table-changes">{{ chinese ? '未保存修改' : 'Unsaved edit' }}</span>
          </div>
          <template v-if="editing">
            <ElInput ref="cell-input" type="textarea" :rows="6" :model-value="editContent" :aria-label="`${selected.index + 1} / ${selected.key}`" :aria-invalid="!!selectedCell?.error" resize="vertical" @update:model-value="draftCell" />
            <p v-if="selectedCell?.error" class="dataset-editor-error" role="alert">
              {{ selectedCell.error }}
            </p>
            <p class="dataset-cell-edit-hint">
              {{ chinese ? '修改保留为草稿，点击「保存数据」后生效。数字、布尔和 JSON 按原类型解析。' : 'Edits remain in the draft until Save data. Numbers, booleans and JSON use their original type.' }}
            </p>
          </template>
          <pre v-else class="dataset-cell-full-value" data-dataset-full-value :class="{ 'is-json': selectedKind === 'object' || selectedKind === 'array' }">{{ selectedContent || (selectedKind === 'missing' ? (chinese ? '未设置' : 'Not set') : (chinese ? '空字符串' : 'Empty string')) }}</pre>
          <div class="dataset-cell-detail-actions">
            <ElButton v-if="editing" @click="editing = false">
              <Check :size="14" aria-hidden="true" />{{ chinese ? '完成编辑' : 'Done editing' }}
            </ElButton>
            <ElButton v-else @click="selectCell(selected.index, selected.key, true)">
              <Pencil :size="14" aria-hidden="true" />{{ chinese ? '编辑内容' : 'Edit value' }}
            </ElButton>
            <ElButton :disabled="selectedKind === 'missing'" @click="copyCell">
              <Check v-if="copied" :size="14" aria-hidden="true" /><Copy v-else :size="14" aria-hidden="true" />{{ copied ? (chinese ? '已复制' : 'Copied') : (chinese ? '复制' : 'Copy') }}
            </ElButton>
            <ElButton v-if="hasDraft(selected.index, selected.key)" text @click="resetCell">
              {{ chinese ? '撤销本格修改' : 'Revert cell' }}
            </ElButton>
          </div>
        </aside>
      </div>
      <div class="dataset-table-footer">
        <span class="dataset-table-range">{{ rangeStart }}–{{ rangeEnd }} / {{ filtered.length.toLocaleString() }} {{ chinese ? '行' : 'rows' }}<template v-if="query"> · {{ chinese ? `共 ${rows.length} 行` : `${rows.length} total` }}</template></span>
        <div class="dataset-table-pagination">
          <ElSelect v-model="size" :aria-label="chinese ? '每页行数' : 'Page size'" append-to="#workbench-overlays">
            <ElOption v-for="value in [25, 50, 100]" :key="value" :value="value" :label="chinese ? `${value} 行 / 页` : `${value} / page`" />
          </ElSelect>
          <ElButton :disabled="page <= 1" :aria-label="chinese ? '上一页' : 'Previous page'" @click="page--">
            <ChevronLeft :size="15" aria-hidden="true" />
          </ElButton><span>{{ page }} / {{ pages }}</span><ElButton :disabled="page >= pages" :aria-label="chinese ? '下一页' : 'Next page'" @click="page++">
            <ChevronRight :size="15" aria-hidden="true" />
          </ElButton>
        </div>
        <ElButton type="primary" data-dataset-table-save @click="save">
          {{ chinese ? '保存数据' : 'Save data' }}<span v-if="modified" class="dataset-save-count">{{ modified }}</span>
        </ElButton>
      </div>
    </template>
  </section>
</template>
