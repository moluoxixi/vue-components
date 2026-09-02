# HeadlessTable

无渲染的表格核心组件，通过默认插槽暴露完整的列/行/渲染上下文，可与任意 UI 框架（Element Plus、Vxe-Table 等）组合使用。配套 `useHeadlessTable` composable 提供排序、筛选、分页和行选择状态管理。

## 与 Element Plus 集成

:::demo 用 `HeadlessTable` 提供列配置，在默认插槽内接入 `ElTable`，无需改动 `useHeadlessTable` 逻辑。

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
  { id: 1, code: 'W-001', name: '华东仓', status: '启用', utilization: 87 },
  { id: 2, code: 'W-002', name: '华南仓', status: '启用', utilization: 63 },
  { id: 3, code: 'W-003', name: '西南仓', status: '维护', utilization: 12 },
  { id: 4, code: 'W-004', name: '华北仓', status: '启用', utilization: 91 },
]

const baseColumns: HeadlessTableColumn<WarehouseRow>[] = [
  { field: 'code', title: '仓库编码', width: 120 },
  { field: 'name', title: '仓库名称', minWidth: 150 },
  { field: 'utilization', title: '利用率', width: 120, align: 'right', formatter: ({ value }) => `${value}%` },
  { field: 'status', title: '状态', width: 90, align: 'center', slots: { default: 'status' } },
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

行和单元格 API 需要 `getRowId` 提供稳定行标识，列标识使用 `column.id`，未提供时回退到 `field`。`setMode`、`setRowMode`、`setCellMode`、单项/批量 `clear*`、`getRowMode`、`getCellMode` 方法也会暴露在默认插槽作用域中。`clearAllCellModes` 仅清除单元格 override，`clearAllRowModes` 仅清除行 override，`clearAllModes` 清除整表 API、行和单元格的全部 override。

`setRowMode` 和 `setCellMode` 既可传稳定 ID，也可传 selector。行 selector 接收 `{ row, rowIndex, rowId }`，单元格 selector 还会收到 `{ column, columnIndex, columnId }`；所有匹配项都会切换为指定模式。selector 仅在调用 API 时扫描一次当前 `data`，命中结果仍按稳定的行列 ID 保存，因此后续数据重排不会导致模式漂移。

每次有效的 API 变更都会触发 `modeChange` 事件。单项变更包含操作范围、动作及变更前后的有效模式；批量清理包含范围、`clearAll` 动作和清理数量。重复设置同一 override 或清理不存在的 override 不触发事件。该事件仅用于观察状态，不会触发 `update:mode`。

列的 `slots.edit` 可以是内联渲染函数或具名插槽名称。有效模式为 `edit` 时优先使用 edit 插槽；edit 插槽不存在时继续使用原有的 default 插槽、renderer、`formatter` 和原始值。edit/default 插槽作用域都包含 `mode`、`rowId`、行列上下文及当前行/单元格的模式操作。

下面的示例把三种 API 范围放在同一张表里：表格按钮调用 `setMode`，行按钮调用 `setRowMode`，单元格按钮调用 `setCellMode`。`mode` prop 的开关只改变整张表，点击“清除 API 模式”后即可看到它的效果。

:::demo 使用 `edit` 插槽提供编辑控件，并分别演示表格、行、单元格三种模式范围。

```vue
<script setup lang="ts">
import type { HeadlessTableColumn, HeadlessTableModeChange } from '@moluoxixi/components'
import { ref } from 'vue'
import { HeadlessTable } from '@moluoxixi/components'
import { ElButton, ElInput, ElOption, ElSelect, ElSpace, ElTable, ElTableColumn, ElTag } from 'element-plus'

const propMode = ref<'default' | 'edit'>('default')
const lastChange = ref('等待模式 API 操作')
interface WarehouseRow {
  id: string
  name: string
  status: string
  manager: string
}

const rows = ref<WarehouseRow[]>([
  { id: 'W-001', name: '华东仓', status: '启用', manager: '张三' },
  { id: 'W-002', name: '华南仓', status: '维护', manager: '李四' },
  { id: 'W-003', name: '西南仓', status: '启用', manager: '王五' },
])
const columns: HeadlessTableColumn<WarehouseRow>[] = [
  { field: 'name', title: '仓库名称', minWidth: 160, slots: { edit: 'editName' } },
  { field: 'status', title: '状态', width: 120, slots: { edit: 'editStatus' } },
  { field: 'manager', title: '负责人', minWidth: 120 },
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
        <ElButton type="primary" size="small" @click="setMode('edit')">整表进入 edit</ElButton>
        <ElButton size="small" @click="setRowMode('W-001', 'edit')">W-001 行进入 edit</ElButton>
        <ElButton size="small" @click="setCellMode('W-002', 'status', 'edit')">W-002 / 状态单元格进入 edit</ElButton>
        <ElButton size="small" @click="setRowMode(({ row }) => row.status === '启用', 'edit')"
          >所有启用行进入 edit</ElButton
        >
        <ElButton size="small" @click="setCellMode(({ columnId }) => columnId === 'name', 'edit')"
          >所有名称单元格进入 edit</ElButton
        >
        <ElButton size="small" @click="clearAllModes">清除 API 模式</ElButton>
        <span>mode prop：</span>
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
            <component :is="Cell" :row="row" :column="column" :row-index="$index" :column-index="columnIndex" />
          </template>
        </ElTableColumn>
      </ElTable>
    </template>
    <template #editName="{ row, clearCellMode }">
      <ElInput v-model="row.name" size="small" @keyup.enter="clearCellMode" />
    </template>
    <template #editStatus="{ row, clearCellMode }">
      <ElSelect v-model="row.status" size="small" @change="clearCellMode">
        <ElOption label="启用" value="启用" />
        <ElOption label="维护" value="维护" />
      </ElSelect>
    </template>
  </HeadlessTable>
</template>
```

:::

进入编辑模式的触发控件、保存/取消、校验和行数据更新均由使用方实现。

## useHeadlessTable 排序与筛选

:::demo `useHeadlessTable` 提供客户端排序、筛选和分页，与任意表格 UI 解耦。

```vue
<script setup lang="ts">
import type { HeadlessTableColumn } from '@moluoxixi/components'
import { ref } from 'vue'
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
  name: `商品 ${String(i + 1).padStart(3, '0')}`,
  price: Math.round(Math.random() * 900 + 100),
  stock: Math.round(Math.random() * 200),
}))

const columns: HeadlessTableColumn<ProductRow>[] = [
  { field: 'id', title: 'ID', width: 60 },
  { field: 'name', title: '商品', minWidth: 160, filter: (_, query, row) => row.name.includes(String(query)) },
  {
    field: 'price',
    title: '价格',
    width: 100,
    align: 'right',
    formatter: ({ value }) => `¥${value}`,
    sorter: (a, b) => a.price - b.price,
  },
  { field: 'stock', title: '库存', width: 80, align: 'right', sorter: (a, b) => a.stock - b.stock },
]

const table = useHeadlessTable<ProductRow>({
  data: rawRows,
  columns,
  getRowId: r => r.id,
  initialState: { pagination: { pageSize: 5 } },
})

const filterValue = ref('')
function applyFilter(v: string): void {
  filterValue.value = v
  table.setFilter('name', v || undefined)
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
      placeholder="搜索商品"
      clearable
      style="width:200px;"
      @input="applyFilter"
      @clear="applyFilter('')"
    />
    <span style="line-height:32px;font-size:13px;color:#909399;"> 共 {{ table.total.value }} 条 </span>
  </div>

  <ElTable :data="table.rows.value" border size="small" style="width:100%" @sort-change="applySorting">
    <ElTableColumn prop="id" label="ID" width="60" />
    <ElTableColumn prop="name" label="商品" min-width="160" />
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
