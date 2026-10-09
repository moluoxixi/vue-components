<script setup lang="ts">
import type { ModelJsonObject, ModelJsonValue } from '@moluoxixi/config-form-model'
import { Plus, Search, Trash2 } from '@lucide/vue'
import { createDatasetFromRows } from '@moluoxixi/config-form-model'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ json: string, locale: string }>()
const emit = defineEmits<{ 'update:json': [value: string], 'save': [] }>()
const chinese = computed(() => props.locale === 'zh-CN')
const query = ref('')
const columnName = ref('')
const page = ref(1)
const size = ref(25)
const error = ref('')
const cellDrafts = defineModel<Record<string, string>>('cells', { default: () => ({}) })
let lastCommitted = ''
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
const columns = computed(() => [...new Set(rows.value.flatMap(row => Object.keys(row)))])
const filtered = computed(() =>
  rows.value
    .map((row, index) => ({ row, index }))
    .filter(entry => JSON.stringify(entry.row).toLocaleLowerCase().includes(query.value.toLocaleLowerCase())),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))
const visible = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))
watch([query, size, pages], () => {
  page.value = Math.min(page.value, pages.value)
})
watch(
  () => props.json,
  (value) => {
    if (value !== lastCommitted)
      cellDrafts.value = {}
  },
)
function commit(next: ModelJsonObject[]): void {
  lastCommitted = JSON.stringify(next, null, 2)
  emit('update:json', lastCommitted)
  error.value = ''
}
function cellValue(value: ModelJsonValue | undefined): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
}
function cellKey(index: number, key: string): string {
  return JSON.stringify([index, key])
}
function draftCell(index: number, key: string, input: string | number): void {
  cellDrafts.value[cellKey(index, key)] = String(input)
  error.value = ''
}
function applyDrafts(): ModelJsonObject[] | undefined {
  const next = structuredClone(rows.value)
  try {
    for (const [address, input] of Object.entries(cellDrafts.value)) {
      const [index, key] = JSON.parse(address) as [number, string]
      const previous = rows.value[index]?.[key]
      let value: ModelJsonValue = input
      try {
        if (typeof previous === 'number') {
          if (!input.trim() || !Number.isFinite(Number(input)))
            throw new TypeError(chinese.value ? '请输入有效数字' : 'Enter a finite number')
          value = Number(input)
        }
        else if (typeof previous === 'boolean' || typeof previous === 'object') {
          value = JSON.parse(input)
          if (typeof previous === 'boolean' && typeof value !== 'boolean')
            throw new TypeError('Expected true or false')
        }
        next[index]![key] = value
      }
      catch (reason) {
        throw new TypeError(`${index + 1} / ${key}: ${reason instanceof Error ? reason.message : String(reason)}`)
      }
    }
    cellDrafts.value = {}
    return next
  }
  catch (value) {
    error.value = value instanceof Error ? value.message : String(value)
  }
}
async function save(): Promise<void> {
  const next = applyDrafts()
  if (!next)
    return
  commit(next)
  await nextTick()
  emit('save')
}
async function addRow(): Promise<void> {
  const next = applyDrafts()
  if (!next)
    return
  next.push(Object.fromEntries(columns.value.map(key => [key, ''])))
  commit(next)
  query.value = ''
  await nextTick()
  page.value = Math.ceil(next.length / size.value)
}
function removeRow(index: number): void {
  const next = applyDrafts()
  if (next)
    commit(next.filter((_, rowIndex) => rowIndex !== index))
}
function removeColumn(key: string): void {
  const next = applyDrafts()
  if (next) {
    commit(
      next.map((row) => {
        delete row[key]
        return row
      }),
    )
  }
}
function addColumn(): void {
  const key = columnName.value.trim()
  if (!key || columns.value.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
    error.value = chinese.value ? '请输入不重复的安全列名' : 'Enter a unique, safe column name'
    return
  }
  const next = applyDrafts()
  if (!next)
    return
  commit((next.length ? next : [{}]).map(row => ({ ...row, [key]: '' })))
  columnName.value = ''
}
</script>

<template>
  <section class="dataset-table-editor">
    <p v-if="parsed.error" class="dataset-editor-error" role="alert">
      {{ parsed.error }} · {{ chinese ? '请在 JSON 页修正草稿。' : 'Correct the draft in the JSON tab.' }}
    </p>
    <template v-else>
      <div class="dataset-editor-toolbar">
        <div class="dataset-editor-search">
          <Search :size="14" /><ElInput
            v-model="query"
            :aria-label="chinese ? '筛选数据行' : 'Filter rows'"
            :placeholder="chinese ? '筛选数据行…' : 'Filter rows…'"
          />
        </div>
        <button type="button" @click="addRow">
          <Plus :size="14" />{{ chinese ? '添加行' : 'Add row' }}
        </button>
        <ElInput
          v-model="columnName"
          class="dataset-column-name"
          :aria-label="chinese ? '新列名' : 'New column name'"
          :placeholder="chinese ? '新列名' : 'Column name'"
          @keydown.enter.prevent="addColumn"
        /><button type="button" @click="addColumn">
          {{ chinese ? '添加列' : 'Add column' }}
        </button>
      </div>
      <p class="dataset-editor-hint">
        {{
          chinese
            ? '编辑后保存为一个可撤销操作。数字、布尔与对象保持类型；嵌套值使用 JSON。'
            : 'Save edits as one undoable command. Numbers, booleans and objects preserve their types; nested values use JSON.'
        }}
      </p>
      <p v-if="error" class="dataset-editor-error" role="alert">
        {{ error }}
      </p>
      <div class="dataset-table-scroll" data-asset-dataset-table>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th v-for="key in columns" :key="key">
                {{ key
                }}<button
                  type="button"
                  :aria-label="chinese ? `删除列 ${key}` : `Delete column ${key}`"
                  @click="removeColumn(key)"
                >
                  <Trash2 :size="12" />
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in visible" :key="entry.index">
              <th>{{ entry.index + 1 }}</th>
              <td v-for="key in columns" :key="key">
                <ElInput
                  :model-value="cellDrafts[cellKey(entry.index, key)] ?? cellValue(entry.row[key])"
                  :aria-label="`${entry.index + 1} / ${key}`"
                  @update:model-value="draftCell(entry.index, key, $event)"
                />
              </td>
              <td>
                <button
                  type="button"
                  :aria-label="chinese ? `删除第 ${entry.index + 1} 行` : `Delete row ${entry.index + 1}`"
                  @click="removeRow(entry.index)"
                >
                  <Trash2 :size="13" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!visible.length">
          {{ chinese ? '暂无数据，添加行或导入数据。' : 'No rows. Add a row or import data.' }}
        </p>
      </div>
      <div class="dataset-editor-toolbar dataset-pagination">
        <span>{{ filtered.length }} / {{ rows.length }} {{ chinese ? '行' : 'rows' }}</span><ElSelect v-model="size" :aria-label="chinese ? '每页行数' : 'Page size'" append-to="#workbench-overlays">
          <ElOption v-for="value in [25, 50, 100]" :key="value" :value="value" :label="String(value)" />
        </ElSelect><button type="button" :disabled="page <= 1" @click="page--">
          ←
        </button><span>{{ page }} / {{ pages }}</span><button type="button" :disabled="page >= pages" @click="page++">
          →
        </button><ElButton type="primary" data-dataset-table-save @click="save">
          {{ chinese ? '保存数据' : 'Save data' }}
        </ElButton>
      </div>
    </template>
  </section>
</template>
