# HeadlessTable

A renderless table core that exposes column, row, and rendering contexts through its default slot. It can be combined with any UI framework. The companion `useHeadlessTable` composable manages sorting, filtering, pagination, and row selection.

## Integrating with Element Plus

:::demo Use `HeadlessTable` for column configuration and render the result with `ElTable` inside the default slot.

```vue
<script setup lang="ts">
import type { HeadlessTableColumn } from '@moluoxixi/components'
import { HeadlessTable } from '@moluoxixi/components'
import { ElTable, ElTableColumn, ElTag } from 'element-plus'

interface WarehouseRow {
  id: number
  code: string
  name: string
  status: string
  utilization: number
}

const rows: WarehouseRow[] = [
  { id: 1, code: 'W-001', name: 'East Warehouse', status: 'Active', utilization: 87 },
  { id: 2, code: 'W-002', name: 'South Warehouse', status: 'Active', utilization: 63 },
  { id: 3, code: 'W-003', name: 'West Warehouse', status: 'Maintenance', utilization: 12 },
]

const columns: HeadlessTableColumn<WarehouseRow>[] = [
  { field: 'code', title: 'Code', width: 120 },
  { field: 'name', title: 'Name', minWidth: 170 },
  {
    field: 'utilization',
    title: 'Utilization',
    width: 120,
    align: 'right',
    formatter: ({ value }) => `${value}%`,
  },
  { field: 'status', title: 'Status', width: 120, align: 'center', slots: { default: 'status' } },
]
</script>

<template>
  <HeadlessTable :columns="columns" :data="rows">
    <template #default="{ columns: resolvedColumns, data, getCellValue }">
      <ElTable :data="data" border size="small" style="width:100%">
        <ElTableColumn
          v-for="(column, columnIndex) in resolvedColumns"
          :key="column.field ?? column.id"
          :prop="column.field"
          :label="column.title"
          :width="column.width"
          :min-width="column.minWidth"
          :align="column.align"
        >
          <template #default="{ row, $index }">
            <ElTag
              v-if="column.slots?.default === 'status'"
              :type="row.status === 'Active' ? 'success' : 'warning'"
              size="small"
            >
              {{ row.status }}
            </ElTag>
            <template v-else>
              {{ getCellValue(row, column, $index, columnIndex) }}
            </template>
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
  </HeadlessTable>
</template>
```

:::

## Editing Modes

The `mode` prop controls the whole table only and defaults to `default`. The component instance API can also target the table, a stable row ID, or one cell. Effective precedence is: cell, row, table API, `mode` prop, then `default`.

Row and cell APIs require a stable ID from `getRowId`. A column uses `column.id` as its stable ID and falls back to `field`. The default slot scope also exposes `setMode`, `setRowMode`, `setCellMode`, single and bulk `clear*` methods, `getRowMode`, and `getCellMode`. `clearAllCellModes` removes cell overrides only, `clearAllRowModes` removes row overrides only, and `clearAllModes` removes table API, row, and cell overrides together.

`setRowMode` and `setCellMode` accept either stable IDs or a selector. A row selector receives `{ row, rowIndex, rowId }`; a cell selector also receives `{ column, columnIndex, columnId }`. All matches switch to the requested mode. A selector scans the current `data` once when the API is called. Matches are still stored by stable row and column IDs, so later data reordering does not move their modes.

Every effective API mutation emits `modeChange`. Single-scope changes include the scope, action, and previous/next effective modes; bulk clears include the scope, `clearAll` action, and cleared override count. Repeating the same override or clearing a missing override does not emit. This event is observational and never emits `update:mode`.

`columns[].slots.edit` accepts either an inline render function or a named slot. A cell in `edit` mode tries its edit slot first. If none is available, rendering continues through the existing default slot, renderer, `formatter`, and raw-value chain. Both edit and default slot scopes include `mode`, `rowId`, row and column context, and scoped row/cell mode actions.

The interactive example below keeps all three API scopes together: the table button calls `setMode`, the row button calls `setRowMode`, and the cell button calls `setCellMode`. The `mode` prop switch affects the whole table; use “Clear API modes” to reveal the prop-controlled state again.

:::demo Use an `edit` slot for form controls and compare table-, row-, and cell-level mode changes.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { HeadlessTableColumn, HeadlessTableModeChange } from '@moluoxixi/components'
import { HeadlessTable } from '@moluoxixi/components'
import { ElButton, ElInput, ElOption, ElSelect, ElSpace, ElTable, ElTableColumn, ElTag } from 'element-plus'

const propMode = ref<'default' | 'edit'>('default')
const lastChange = ref('Waiting for a mode API operation')
interface WarehouseRow {
  id: string
  name: string
  status: string
  manager: string
}

const rows = ref<WarehouseRow[]>([
  { id: 'W-001', name: 'East Warehouse', status: 'Active', manager: 'Avery' },
  { id: 'W-002', name: 'South Warehouse', status: 'Maintenance', manager: 'Blake' },
  { id: 'W-003', name: 'West Warehouse', status: 'Active', manager: 'Casey' },
])
const columns: HeadlessTableColumn<WarehouseRow>[] = [
  { field: 'name', title: 'Warehouse', minWidth: 160, slots: { edit: 'editName' } },
  { field: 'status', title: 'Status', width: 120, slots: { edit: 'editStatus' } },
  { field: 'manager', title: 'Manager', minWidth: 120 },
]

function handleModeChange(change: HeadlessTableModeChange): void {
  lastChange.value = `${change.scope} scope: ${change.action}`
}
</script>

<template>
  <HeadlessTable
    :columns="columns"
    :data="rows"
    :get-row-id="row => row.id"
    :mode="propMode"
    @mode-change="handleModeChange"
  >
    <template #default="{ Cell, columns: resolvedColumns, data, setMode, setRowMode, setCellMode, clearAllModes }">
      <ElSpace wrap style="margin-bottom: 12px">
        <ElButton type="primary" size="small" @click="setMode('edit')">Edit whole table</ElButton>
        <ElButton size="small" @click="setRowMode('W-001', 'edit')">Edit W-001 row</ElButton>
        <ElButton size="small" @click="setCellMode('W-002', 'status', 'edit')">Edit W-002 / Status cell</ElButton>
        <ElButton size="small" @click="setRowMode(({ row }) => row.status === 'Active', 'edit')"
          >Edit all active rows</ElButton
        >
        <ElButton size="small" @click="setCellMode(({ columnId }) => columnId === 'name', 'edit')"
          >Edit all Name cells</ElButton
        >
        <ElButton size="small" @click="clearAllModes">Clear API modes</ElButton>
        <span>mode prop:</span>
        <ElSelect v-model="propMode" size="small" style="width: 110px">
          <ElOption label="default" value="default" />
          <ElOption label="edit" value="edit" />
        </ElSelect>
        <ElTag size="small" type="info">{{ lastChange }}</ElTag>
      </ElSpace>
      <ElTable :data="data">
        <ElTableColumn
          v-for="(column, columnIndex) in resolvedColumns"
          :key="column.id ?? column.field"
          :label="column.title"
          :width="column.width"
          :min-width="column.minWidth"
        >
          <template #default="{ row, $index }">
            <Cell :row="row" :column="column" :row-index="$index" :column-index="columnIndex" />
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
    <template #editName="{ row, clearCellMode }">
      <ElInput v-model="row.name" size="small" @keyup.enter="clearCellMode" />
    </template>
    <template #editStatus="{ row, clearCellMode }">
      <ElSelect v-model="row.status" size="small" @change="clearCellMode">
        <ElOption label="Active" value="Active" />
        <ElOption label="Maintenance" value="Maintenance" />
      </ElSelect>
    </template>
  </HeadlessTable>
</template>
```

:::

Consumers own the triggers, save/cancel workflow, validation, and row-data updates.

## Sorting and Filtering with useHeadlessTable

:::demo `useHeadlessTable` provides client-side sorting, filtering, and pagination independently of any table UI.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { HeadlessTableColumn } from '@moluoxixi/components'
import { useHeadlessTable } from '@moluoxixi/components'
import { ElInput, ElPagination, ElTable, ElTableColumn } from 'element-plus'

interface ProductRow {
  id: number
  name: string
  price: number
  stock: number
}

const rawRows: ProductRow[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Product ${String(i + 1).padStart(3, '0')}`,
  price: Math.round(Math.random() * 900 + 100),
  stock: Math.round(Math.random() * 200),
}))

const columns: HeadlessTableColumn<ProductRow>[] = [
  { field: 'id', title: 'ID', width: 60 },
  {
    field: 'name',
    title: 'Product',
    minWidth: 160,
    filter: (_, query, row) => row.name.includes(String(query)),
  },
  {
    field: 'price',
    title: 'Price',
    width: 100,
    align: 'right',
    formatter: ({ value }) => `$${value}`,
    sorter: (a, b) => a.price - b.price,
  },
  {
    field: 'stock',
    title: 'Stock',
    width: 80,
    align: 'right',
    sorter: (a, b) => a.stock - b.stock,
  },
]

const table = useHeadlessTable<ProductRow>({
  data: rawRows,
  columns,
  getRowId: row => row.id,
  initialState: { pagination: { pageSize: 5 } },
})

const filterValue = ref('')
function applyFilter(value: string): void {
  filterValue.value = value
  table.setFilter('name', value || undefined)
  table.setPage(1)
}

function applySorting({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }): void {
  table.setSorting(order ? [{ id: prop, direction: order === 'ascending' ? 'asc' : 'desc' }] : [])
}
</script>

<template>
  <div style="display:flex;gap:8px;margin-bottom:10px;">
    <ElInput
      :model-value="filterValue"
      placeholder="Search products"
      clearable
      style="width:200px;"
      @input="applyFilter"
      @clear="applyFilter('')"
    />
    <span style="line-height:32px;font-size:13px;color:#909399;"> {{ table.total.value }} results </span>
  </div>

  <ElTable :data="table.rows.value" border size="small" style="width:100%" @sort-change="applySorting">
    <ElTableColumn prop="id" label="ID" width="60" />
    <ElTableColumn prop="name" label="Product" min-width="160" />
    <ElTableColumn prop="price" label="Price" width="100" align="right" sortable="custom">
      <template #default="{ row }">${{ row.price }}</template>
    </ElTableColumn>
    <ElTableColumn prop="stock" label="Stock" width="80" align="right" sortable="custom" />
  </ElTable>

  <ElPagination
    :current-page="table.pagination.value.currentPage"
    :page-size="table.pagination.value.pageSize"
    :total="table.total.value"
    layout="prev,pager,next"
    style="margin-top:10px;"
    @current-change="table.setPage"
  />
</template>
```

:::
