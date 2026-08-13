# HeadlessTable

无渲染的表格核心组件，通过默认插槽暴露完整的列/行/渲染上下文，可与任意 UI 框架（Element Plus、Vxe-Table 等）组合使用。配套 `useHeadlessTable` composable 提供排序、筛选、分页和行选择状态管理。

## 与 Element Plus 集成

:::demo 用 `HeadlessTable` 提供列配置，在默认插槽内接入 `ElTable`，无需改动 `useHeadlessTable` 逻辑。
```vue
<script setup lang="ts">
import { HeadlessTable } from '@moluoxixi/components'
import { ElTable, ElTableColumn, ElTag } from 'element-plus'

const rows = [
  { id: 1, code: 'W-001', name: '华东仓', status: '启用',  utilization: 87 },
  { id: 2, code: 'W-002', name: '华南仓', status: '启用',  utilization: 63 },
  { id: 3, code: 'W-003', name: '西南仓', status: '维护',  utilization: 12 },
  { id: 4, code: 'W-004', name: '华北仓', status: '启用',  utilization: 91 },
]

const baseColumns = [
  { field: 'code',        title: '仓库编码', width: 120 },
  { field: 'name',        title: '仓库名称', minWidth: 150 },
  { field: 'utilization', title: '利用率',   width: 120, align: 'right',
    formatter: ({ value }) => `${value}%` },
  { field: 'status',      title: '状态',     width: 90,  align: 'center',
    slots: { default: 'status' } },
]

</script>

<template>
  <HeadlessTable :columns="baseColumns" :data="rows">
    <template #default="{ columns, data, getCellValue }">
      <ElTable :data="data" border size="small" style="width:100%">
        <ElTableColumn
          v-for="(col, columnIndex) in columns"
          :key="col.field ?? col.id"
          :prop="col.field"
          :label="col.title"
          :width="col.width"
          :min-width="col.minWidth"
          :align="col.align"
        >
          <template #default="{ row, $index }">
            <ElTag
              v-if="col.slots?.default === 'status'"
              :type="row.status === '启用' ? 'success' : 'warning'"
              size="small"
            >
              {{ row.status }}
            </ElTag>
            <template v-else>
              {{ getCellValue(row, col, $index, columnIndex) }}
            </template>
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
  </HeadlessTable>
</template>
```
:::

## 编辑模式

`mode` prop 只控制整个表格，默认值为 `default`。组件实例 API 还可以通过稳定行标识切换整表、单行或单元格；解析优先级为：单元格、行、整表 API、`mode` prop、`default`。

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

行和单元格 API 需要 `getRowId` 提供稳定行标识，列标识使用 `column.id`，未提供时回退到 `field`。`setMode`、`setRowMode`、`setCellMode`、单项/批量 `clear*`、`getRowMode`、`getCellMode` 方法也会暴露在默认插槽作用域中。`clearAllCellModes` 仅清除单元格 override，`clearAllRowModes` 仅清除行 override，`clearAllModes` 清除整表 API、行和单元格的全部 override。

每次有效的 API 变更都会触发 `modeChange` 事件。单项变更包含操作范围、动作及变更前后的有效模式；批量清理包含范围、`clearAll` 动作和清理数量。重复设置同一 override 或清理不存在的 override 不触发事件。该事件仅用于观察状态，不会触发 `update:mode`。

列的 `slots.edit` 可以是内联渲染函数或具名插槽名称。有效模式为 `edit` 时优先使用 edit 插槽；edit 插槽不存在时继续使用原有的 default 插槽、renderer、`formatter` 和原始值。edit/default 插槽作用域都包含 `mode`、`rowId`、行列上下文及当前行/单元格的模式操作。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { HeadlessTable } from '@moluoxixi/components'
import { ElInput, ElTable, ElTableColumn } from 'element-plus'

const tableRef = ref()
const rows = ref([
  { id: 'W-001', name: '华东仓' },
  { id: 'W-002', name: '华南仓' },
])
const columns = [
  { field: 'name', title: '仓库名称', slots: { edit: 'editName' } },
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

进入编辑模式的触发控件、保存/取消、校验和行数据更新均由使用方实现。

## useHeadlessTable 排序与筛选

:::demo `useHeadlessTable` 提供客户端排序、筛选和分页，与任意表格 UI 解耦。
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useHeadlessTable } from '@moluoxixi/components'
import { ElInput, ElPagination, ElTable, ElTableColumn } from 'element-plus'

const rawRows = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `商品 ${String(i + 1).padStart(3, '0')}`,
  price: Math.round(Math.random() * 900 + 100),
  stock: Math.round(Math.random() * 200),
}))

const columns = [
  { field: 'id',    title: 'ID',   width: 60 },
  { field: 'name',  title: '商品', minWidth: 160,
    filter: (_, query, row) => row.name.includes(String(query)) },
  { field: 'price', title: '价格', width: 100, align: 'right',
    formatter: ({ value }) => `¥${value}`,
    sorter: (a, b) => a.price - b.price },
  { field: 'stock', title: '库存', width: 80,  align: 'right',
    sorter: (a, b) => a.stock - b.stock },
]

const table = useHeadlessTable({
  data: rawRows,
  columns,
  getRowId: r => r.id,
  initialState: { pagination: { pageSize: 5 } },
})

const filterValue = ref('')
function applyFilter(v) {
  filterValue.value = v
  table.setFilter('name', v || undefined)
  table.setPage(1)
}

function applySorting({ prop, order }) {
  table.setSorting(order
    ? [{ id: prop, direction: order === 'ascending' ? 'asc' : 'desc' }]
    : [])
}
</script>

<template>
  <div style="display:flex;gap:8px;margin-bottom:10px;">
    <ElInput
      :model-value="filterValue"
      placeholder="搜索商品"
      clearable
      style="width:200px;"
      @input="applyFilter"
      @clear="applyFilter('')"
    />
    <span style="line-height:32px;font-size:13px;color:#909399;">
      共 {{ table.total.value }} 条
    </span>
  </div>

  <ElTable
    :data="table.rows.value"
    border
    size="small"
    style="width:100%"
    @sort-change="applySorting"
  >
    <ElTableColumn prop="id"    label="ID"   width="60" />
    <ElTableColumn prop="name"  label="商品" min-width="160" />
    <ElTableColumn prop="price" label="价格" width="100" align="right" sortable="custom">
      <template #default="{ row }">¥{{ row.price }}</template>
    </ElTableColumn>
    <ElTableColumn prop="stock" label="库存" width="80" align="right" sortable="custom" />
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

## useHeadlessTable

`useHeadlessTable(options)` 返回响应式的 `rows`、`filteredRows`、`total`、`pageCount`、`pagination`、`sorting` 和 `selectedKeys`，并提供 `setPage`、`setPageSize`、`toggleSorting`、`setFilter`、`resetFilters`、`toggleRowSelected`、`setSelectedKeys`、`clearSelection` 与 `reset` 等操作方法。完整类型以包内导出的 `UseHeadlessTableReturn` 为准。
