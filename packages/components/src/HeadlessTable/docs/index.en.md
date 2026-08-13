# HeadlessTable

A renderless table core that exposes column, row, and rendering contexts through its default slot. It can be combined with any UI framework. The companion `useHeadlessTable` composable manages sorting, filtering, pagination, and row selection.

## Integrating with Element Plus

:::demo Use `HeadlessTable` for column configuration and render the result with `ElTable` inside the default slot.
```vue
<script setup lang="ts">
import { HeadlessTable } from '@moluoxixi/components'
import { ElTable, ElTableColumn, ElTag } from 'element-plus'

const rows = [
  { id: 1, code: 'W-001', name: 'East Warehouse', status: 'Active', utilization: 87 },
  { id: 2, code: 'W-002', name: 'South Warehouse', status: 'Active', utilization: 63 },
  { id: 3, code: 'W-003', name: 'West Warehouse', status: 'Maintenance', utilization: 12 },
]

const columns = [
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

```ts
tableRef.value?.setMode('edit')
tableRef.value?.setRowMode('W-001', 'edit')
tableRef.value?.setCellMode('W-001', 'name', 'edit')

tableRef.value?.clearCellMode('W-001', 'name')
tableRef.value?.clearRowMode('W-001')
tableRef.value?.clearMode()

tableRef.value?.clearAllCellModes()
tableRef.value?.clearAllRowModes()
tableRef.value?.clearAllModes()
```

Row and cell APIs require a stable ID from `getRowId`. A column uses `column.id` as its stable ID and falls back to `field`. The default slot scope also exposes `setMode`, `setRowMode`, `setCellMode`, single and bulk `clear*` methods, `getRowMode`, and `getCellMode`. `clearAllCellModes` removes cell overrides only, `clearAllRowModes` removes row overrides only, and `clearAllModes` removes table API, row, and cell overrides together.

Every effective API mutation emits `modeChange`. Single-scope changes include the scope, action, and previous/next effective modes; bulk clears include the scope, `clearAll` action, and cleared override count. Repeating the same override or clearing a missing override does not emit. This event is observational and never emits `update:mode`.

`columns[].slots.edit` accepts either an inline render function or a named slot. A cell in `edit` mode tries its edit slot first. If none is available, rendering continues through the existing default slot, renderer, `formatter`, and raw-value chain. Both edit and default slot scopes include `mode`, `rowId`, row and column context, and scoped row/cell mode actions.

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { HeadlessTable } from '@moluoxixi/components'
import { ElInput, ElTable, ElTableColumn } from 'element-plus'

const tableRef = ref()
const rows = ref([
  { id: 'W-001', name: 'East Warehouse' },
  { id: 'W-002', name: 'South Warehouse' },
])
const columns = [
  { field: 'name', title: 'Warehouse', slots: { edit: 'editName' } },
]
</script>

<template>
  <HeadlessTable ref="tableRef" :columns="columns" :data="rows" :get-row-id="row => row.id">
    <template #default="{ Cell, columns: resolvedColumns, data }">
      <ElTable :data="data">
        <ElTableColumn
          v-for="(column, columnIndex) in resolvedColumns"
          :key="column.id ?? column.field"
          :label="column.title"
        >
          <template #default="{ row, $index }">
            <Cell :row="row" :column="column" :row-index="$index" :column-index="columnIndex" />
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
    <template #editName="{ row }">
      <ElInput v-model="row.name" />
    </template>
  </HeadlessTable>
</template>
```

Consumers own the triggers, save/cancel workflow, validation, and row-data updates.

## Sorting and Filtering with useHeadlessTable

:::demo `useHeadlessTable` provides client-side sorting, filtering, and pagination independently of any table UI.
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useHeadlessTable } from '@moluoxixi/components'
import { ElInput, ElPagination, ElTable, ElTableColumn } from 'element-plus'

const rawRows = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Product ${String(i + 1).padStart(3, '0')}`,
  price: Math.round(Math.random() * 900 + 100),
  stock: Math.round(Math.random() * 200),
}))

const columns = [
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

const table = useHeadlessTable({
  data: rawRows,
  columns,
  getRowId: row => row.id,
  initialState: { pagination: { pageSize: 5 } },
})

const filterValue = ref('')
function applyFilter(value) {
  filterValue.value = value
  table.setFilter('name', value || undefined)
  table.setPage(1)
}

function applySorting({ prop, order }) {
  table.setSorting(
    order
      ? [{ id: prop, direction: order === 'ascending' ? 'asc' : 'desc' }]
      : [],
  )
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
    <span style="line-height:32px;font-size:13px;color:#909399;">
      {{ table.total.value }} results
    </span>
  </div>

  <ElTable
    :data="table.rows.value"
    border
    size="small"
    style="width:100%"
    @sort-change="applySorting"
  >
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
