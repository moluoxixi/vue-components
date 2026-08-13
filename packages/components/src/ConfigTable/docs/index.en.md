# ConfigTable

A high-performance, configuration-driven virtual table built on Element Plus `ElTableV2`. It supports remote data, pagination, custom renderers, and slots.

## Basic Usage

:::demo Provide `columns` and static `data` to render a virtualized table. `width` accepts either a pixel number or a CSS width such as `100%` and `calc(...)`.
```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
import { shallowRef } from 'vue'

interface EmployeeRow {
  id: number
  name: string
  department: string
  role: string
}

const columns: ConfigTableColumn[] = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'department', title: 'Department', minWidth: 140 },
  { field: 'role', title: 'Role', minWidth: 150 },
]
const data = shallowRef<EmployeeRow[]>([
  { id: 1, name: 'Avery', department: 'Engineering', role: 'Frontend Engineer' },
  { id: 2, name: 'Blake', department: 'Product', role: 'Product Manager' },
  { id: 3, name: 'Casey', department: 'Operations', role: 'Operations Specialist' },
  { id: 4, name: 'Drew', department: 'Engineering', role: 'Backend Engineer' },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" width="100%" :height="240" />
</template>
```
:::

## Renderer

:::demo Register a named renderer once and reuse it across table instances.
```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { ConfigTable, defineHeadlessTableRenderer, headlessTableRenderer } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { h, shallowRef } from 'vue'

interface AccountRow {
  name: string
  score: number
  status: string
}

headlessTableRenderer.replace('docs-config-status-en', defineHeadlessTableRenderer<AccountRow>({
  renderDefault: (_, { rawValue }) => h(
    ElTag,
    { size: 'small', type: rawValue === 'Active' ? 'success' : 'warning' },
    () => rawValue,
  ),
}))

const columns: ConfigTableColumn[] = [
  { field: 'name', title: 'Name', minWidth: 140 },
  {
    field: 'status',
    title: 'Status',
    width: 110,
    align: 'center',
    cellRender: 'docs-config-status-en',
  },
  { field: 'score', title: 'Score', width: 100, align: 'right' },
]
const data = shallowRef<AccountRow[]>([
  { name: 'Avery', status: 'Active', score: 92 },
  { name: 'Blake', status: 'Maintenance', score: 78 },
  { name: 'Casey', status: 'Active', score: 85 },
])
</script>

<template>
  <ConfigTable
    :columns="columns"
    :data="data"
    width="100%"
    :height="200"
  />
</template>
```
:::

Default column content resolves in this order: an inline renderer or named slot, a named renderer, `formatter`, and finally the raw field value. Edit mode tries `slots.edit` first and falls back to that unchanged chain. `column.id` is the stable key used by column settings and cell modes; when omitted, `field` is used.

## Column Configuration Pane

Use `pane` to enable the built-in column configuration pane. Users can drag columns into a new order, toggle visibility, and edit widths. `pane.width` controls the pane width, while `pane.draggable` disables or enables drag sorting. Column settings are managed internally by default; pass `columnOrder`, `columnVisibility`, `columnWidths`, or their matching `v-model` bindings only when persistence or external control is needed. The previous `columnConfig` prop remains available as a compatibility alias.

:::demo Manage column order, visibility, and widths with a configured pane.
```vue
<script setup lang="ts">
import type { ConfigTableColumn, ConfigTablePaneConfig } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
import { shallowRef } from 'vue'

interface EmployeeRow {
  name: string
  department: string
  role: string
  status: string
}

const pane: ConfigTablePaneConfig = {
  buttonText: 'Configure columns',
  title: 'Column configuration',
  width: 520,
  draggable: true,
  minColumnWidth: 80,
  maxColumnWidth: 360,
}
const columns: ConfigTableColumn[] = [
  { id: 'name', field: 'name', title: 'Name', width: 160 },
  { id: 'department', field: 'department', title: 'Department', width: 150 },
  { id: 'role', field: 'role', title: 'Role', width: 180 },
  { id: 'status', field: 'status', title: 'Status', width: 110 },
]
const data = shallowRef<EmployeeRow[]>([
  { name: 'Avery', department: 'Engineering', role: 'Frontend Engineer', status: 'Active' },
  { name: 'Blake', department: 'Product', role: 'Product Manager', status: 'Disabled' },
  { name: 'Casey', department: 'Operations', role: 'Operations Specialist', status: 'Active' },
])
</script>

<template>
  <ConfigTable
    :columns="columns"
    :data="data"
    :pane="pane"
    width="100%"
    :height="220"
  />
</template>
```
:::

## Remote Data and Pagination

:::demo Provide a `query` function to load data and display the pagination controls automatically.
```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'

interface UserRow {
  id: number
  name: string
  status: string
}

interface UserQueryParams {
  currentPage: number
  pageSize: number
}

interface UserQueryResult {
  data: UserRow[]
  total: number
}

const columns: ConfigTableColumn[] = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'status', title: 'Status', width: 100, align: 'center' },
]

async function queryUsers({ currentPage, pageSize }: UserQueryParams): Promise<UserQueryResult> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  const total = 45
  const data = Array.from({ length: pageSize }, (_, index) => {
    const id = (currentPage - 1) * pageSize + index + 1
    return { id, name: `User ${id}`, status: index % 3 === 0 ? 'Disabled' : 'Active' }
  }).filter(user => user.id <= total)
  return { data, total }
}
</script>
<template>
  <ConfigTable
    :columns="columns"
    :query="queryUsers"
    :width="720"
    :height="260"
    :pagination="{ pageSizes: [10, 20] }"
  />
</template>
```
:::

## Editing Modes

The `mode` prop controls the whole table only and defaults to `default`. The component instance API exposes `setMode`, `setRowMode`, `setCellMode`, their matching single-scope clear methods, plus `clearAllCellModes`, `clearAllRowModes`, and `clearAllModes` for cell, row, or all overrides. `getRowMode` and `getCellMode` read the effective mode. Effective precedence is: cell, row, table API, `mode` prop, then `default`.

Row and cell APIs require a stable row ID from `getRowId` or an explicit `rowKey`. `columns[].slots.edit` accepts either an inline render function or a named slot. Its scope includes `mode`, `rowId`, row and column context, and scoped row/cell mode actions.

`setRowMode` and `setCellMode` accept either stable IDs or a selector. A row selector receives `{ row, rowIndex, rowId }`; a cell selector also receives `{ column, columnIndex, columnId }`. All matches switch to the requested mode. A selector scans the currently loaded data once when the API is called, which means the current page for remote pagination. Matches are still stored by stable row and column IDs, so later data reordering does not move their modes.

The interactive example below keeps all three API scopes together: the table button calls `setMode`, the row button calls `setRowMode`, and the cell button calls `setCellMode`. The `mode` prop switch affects the whole table; use “Clear API modes” to reveal the prop-controlled state again.

:::demo Use an `edit` slot for form controls and compare table-, row-, and cell-level mode changes.
```vue
<script setup lang="ts">
import type {
  ConfigTableColumn,
  HeadlessTableModeApi,
  HeadlessTableModeChange,
} from '@moluoxixi/components'
import { ref } from 'vue'
import { ConfigTable } from '@moluoxixi/components'
import { ElButton, ElInput, ElOption, ElSelect, ElSpace, ElTag } from 'element-plus'

interface UserRow {
  id: string
  name: string
  status: string
  department: string
}

type ConfigTableInstance = HeadlessTableModeApi<UserRow, ConfigTableColumn>

const tableRef = ref<ConfigTableInstance>()
const propMode = ref<'default' | 'edit'>('default')
const lastChange = ref('Waiting for a mode API operation')
const rows = ref<UserRow[]>([
  { id: 'U-001', name: 'Avery', status: 'Active', department: 'Engineering' },
  { id: 'U-002', name: 'Blake', status: 'Disabled', department: 'Product' },
  { id: 'U-003', name: 'Casey', status: 'Active', department: 'Operations' },
])
const columns: ConfigTableColumn[] = [
  { field: 'name', title: 'Name', minWidth: 150, slots: { edit: 'editName' } },
  { field: 'status', title: 'Status', width: 120, slots: { edit: 'editStatus' } },
  { field: 'department', title: 'Department', minWidth: 140 },
]

function applyTableMode() {
  tableRef.value?.setMode('edit')
}

function applyRowMode() {
  tableRef.value?.setRowMode('U-001', 'edit')
}

function applyCellMode() {
  tableRef.value?.setCellMode('U-002', 'status', 'edit')
}

function applyActiveRowsMode() {
  tableRef.value?.setRowMode(({ row }) => row.status === 'Active', 'edit')
}

function applyNameCellsMode() {
  tableRef.value?.setCellMode(({ columnId }) => columnId === 'name', 'edit')
}

function handleModeChange(change: HeadlessTableModeChange) {
  lastChange.value = `${change.scope} scope: ${change.action}`
}
</script>

<template>
  <ElSpace wrap style="margin-bottom: 12px">
    <ElButton type="primary" size="small" @click="applyTableMode">Edit whole table</ElButton>
    <ElButton size="small" @click="applyRowMode">Edit U-001 row</ElButton>
    <ElButton size="small" @click="applyCellMode">Edit U-002 / Status cell</ElButton>
    <ElButton size="small" @click="applyActiveRowsMode">Edit all active rows</ElButton>
    <ElButton size="small" @click="applyNameCellsMode">Edit all Name cells</ElButton>
    <ElButton size="small" @click="tableRef?.clearAllModes()">Clear API modes</ElButton>
    <span>mode prop:</span>
    <ElSelect v-model="propMode" size="small" style="width: 110px">
      <ElOption label="default" value="default" />
      <ElOption label="edit" value="edit" />
    </ElSelect>
    <ElTag size="small" type="info">{{ lastChange }}</ElTag>
  </ElSpace>

  <ConfigTable
    ref="tableRef"
    :columns="columns"
    :data="rows"
    :mode="propMode"
    row-key="id"
    :width="720"
    :height="220"
    @mode-change="handleModeChange"
  >
    <template #editName="{ row, clearCellMode }">
      <ElInput v-model="row.name" size="small" @keyup.enter="clearCellMode" />
    </template>
    <template #editStatus="{ row, clearCellMode }">
      <ElSelect v-model="row.status" size="small" @change="clearCellMode">
        <ElOption label="Active" value="Active" />
        <ElOption label="Disabled" value="Disabled" />
      </ElSelect>
    </template>
  </ConfigTable>
</template>
```
:::

Effective mode API mutations emit `modeChange`; single-scope events include previous/next effective modes and bulk events include the cleared count. The event is observational and does not write back to the `mode` prop. The component does not provide edit triggers, save/cancel behavior, validation, or row-data updates. Consumers own those workflows. A missing edit slot leaves the existing cell rendering unchanged.

## Custom Cell Slots

:::demo Set `column.slots.default` to a slot name and provide the matching named slot in the template.
```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { shallowRef } from 'vue'

interface ScoreRow {
  name: string
  status: string
  score: number
}

const columns: ConfigTableColumn[] = [
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'status', title: 'Status', width: 100, align: 'center', slots: { default: 'status' } },
  { field: 'score', title: 'Score', width: 100, align: 'right', slots: { default: 'score' } },
]
const data = shallowRef<ScoreRow[]>([
  { name: 'Avery', status: 'Active', score: 92 },
  { name: 'Blake', status: 'Disabled', score: 67 },
  { name: 'Casey', status: 'Active', score: 85 },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" :width="720" :height="200">
    <template #status="{ value }">
      <ElTag :type="value === 'Active' ? 'success' : 'danger'" size="small">{{ value }}</ElTag>
    </template>
    <template #score="{ value }">
      <strong>{{ value }}</strong>
    </template>
  </ConfigTable>
</template>
```
:::
