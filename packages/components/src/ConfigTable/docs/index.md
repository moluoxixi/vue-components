# ConfigTable

基于 Element Plus `ElTableV2` 的高性能虚拟滚动配置式表格，支持远程请求、分页、自定义渲染与插槽。

## 基础用法

:::demo 传入 `columns` 配置和静态 `data`，即可渲染虚拟列表表格。`width` 支持像素数值，也支持 `100%`、`calc(...)` 等 CSS 宽度。
```vue
<script setup lang="ts">
import type { ConfigTableColumn } from '@moluoxixi/components'
import { ConfigTable } from '@moluoxixi/components'
import { shallowRef } from 'vue'

interface EmployeeRow {
  id: number
  name: string
  dept: string
  role: string
}

const columns: ConfigTableColumn[] = [
  { field: 'id',   title: 'ID',   width: 80 },
  { field: 'name', title: '姓名', minWidth: 140 },
  { field: 'dept', title: '部门', minWidth: 140 },
  { field: 'role', title: '角色', minWidth: 120 },
]
const data = shallowRef<EmployeeRow[]>([
  { id: 1, name: '张三', dept: '技术部', role: '前端工程师' },
  { id: 2, name: '李四', dept: '产品部', role: '产品经理' },
  { id: 3, name: '王五', dept: '运营部', role: '运营专员' },
  { id: 4, name: '赵六', dept: '技术部', role: '后端工程师' },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" width="100%" :height="240" />
</template>
```
:::

## Renderer

:::demo renderer 可以在应用级 registry 中注册一次，ConfigTable 和 HeadlessTable 的多个实例都能复用。
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

interface StatusRendererProps {
  prefix?: string
}

headlessTableRenderer.replace('docs-config-status', defineHeadlessTableRenderer<AccountRow, StatusRendererProps>({
  renderDefault: (renderOptions, { rawValue }) => h(
    ElTag,
    {
      size: 'small',
      type: rawValue === '启用' ? 'success' : 'warning',
    },
    () => `${renderOptions.props?.prefix ?? ''}${rawValue}`,
  ),
}))
headlessTableRenderer.replace('docs-config-score-header', defineHeadlessTableRenderer<AccountRow>({
  renderHeader: (_, { column }) => h('strong', { style: 'color:#409eff' }, column.title),
}))
const columns: ConfigTableColumn[] = [
  { field: 'name', title: '姓名', minWidth: 140, slots: { header: 'nameHeader' } },
  {
    field: 'status',
    title: '状态',
    width: 110,
    align: 'center',
    cellRender: { name: 'docs-config-status', props: { prefix: '账号' } },
  },
  {
    field: 'score',
    title: '分数',
    width: 100,
    align: 'right',
    headerRender: 'docs-config-score-header',
    formatter: ({ value }) => `${value} 分`,
  },
]
const data = shallowRef<AccountRow[]>([
  { name: '张三', status: '启用', score: 92 },
  { name: '李四', status: '维护', score: 78 },
  { name: '王五', status: '启用', score: 85 },
])
const secondData = shallowRef<AccountRow[]>([
  { name: '赵六', status: '启用', score: 88 },
])
const secondaryColumns = columns.map(column => ({ ...column, slots: undefined }))
</script>

<template>
  <ConfigTable
    :columns="columns"
    :data="data"
    width="100%"
    :height="200"
  >
    <template #nameHeader>
      <strong>姓名（Slot）</strong>
    </template>
  </ConfigTable>
  <ConfigTable
    class="mx-config-table-docs__secondary"
    :columns="secondaryColumns"
    :data="secondData"
    :width="720"
    :height="120"
  />
</template>
```
:::

列内容的默认优先级为：列内联渲染函数或具名 Slot、命名 renderer、`formatter`、原始字段值。edit 模式会先尝试 `slots.edit`，未命中时回退到这条默认渲染链。`column.id` 是列设置和单元格模式使用的稳定标识，未提供时使用 `field`。

## 列配置面板

`pane` 开启内置列配置面板。面板支持拖拽调整顺序、切换列的显示状态和修改列宽；`pane.width` 控制面板宽度，`pane.draggable` 可关闭拖拽。默认由组件内部维护列设置；只有需要持久化或外部控制时，才传入 `columnOrder`、`columnVisibility`、`columnWidths` 或对应的 `v-model`。旧的 `columnConfig` 仍作为兼容别名保留。

:::demo 使用配置化 pane 管理列顺序、显隐与宽度。
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
  buttonText: '配置列',
  title: '列配置',
  width: 520,
  draggable: true,
  minColumnWidth: 80,
  maxColumnWidth: 360,
}
const columns: ConfigTableColumn[] = [
  { id: 'name', field: 'name', title: '姓名', width: 160 },
  { id: 'department', field: 'department', title: '部门', width: 150 },
  { id: 'role', field: 'role', title: '角色', width: 180 },
  { id: 'status', field: 'status', title: '状态', width: 110 },
]
const data = shallowRef<EmployeeRow[]>([
  { name: '张三', department: '技术部', role: '前端工程师', status: '启用' },
  { name: '李四', department: '产品部', role: '产品经理', status: '停用' },
  { name: '王五', department: '运营部', role: '运营专员', status: '启用' },
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

## 远程请求 + 分页

:::demo 传入 `query` 函数，组件自动发请求并展示分页栏。
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
  { field: 'id',     title: 'ID',   width: 80 },
  { field: 'name',   title: '姓名', minWidth: 140 },
  { field: 'status', title: '状态', width: 100, align: 'center' },
]

async function queryUsers({ currentPage, pageSize }: UserQueryParams): Promise<UserQueryResult> {
  await new Promise<void>(resolve => setTimeout(resolve, 200))
  const total = 45
  const list = Array.from({ length: pageSize }, (_, i) => ({
    id: (currentPage - 1) * pageSize + i + 1,
    name: `用户 ${(currentPage - 1) * pageSize + i + 1}`,
    status: i % 3 === 0 ? '禁用' : '启用',
  })).filter(u => u.id <= total)
  return { data: list, total }
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

## 编辑模式

`mode` prop 只控制整个表格，默认值为 `default`。组件实例 API 支持 `setMode`、`setRowMode`、`setCellMode`，以及对应的单项清理；`clearAllCellModes`、`clearAllRowModes`、`clearAllModes` 分别清理单元格、行、全部 override。`getRowMode` 和 `getCellMode` 可读取有效模式。模式优先级为：单元格、行、整表 API、`mode` prop、`default`。

`setRowMode` 和 `setCellMode` 既可传稳定 ID，也可传 selector。行 selector 接收 `{ row, rowIndex, rowId }`，单元格 selector 还会收到 `{ column, columnIndex, columnId }`；所有匹配项都会切换为指定模式。selector 仅在调用 API 时扫描一次当前已加载数据，远程分页时即当前页；命中结果仍按稳定的行列 ID 保存，因此后续数据重排不会导致模式漂移。

下面的示例把三种 API 范围放在同一张表里：表格按钮调用 `setMode`，行按钮调用 `setRowMode`，单元格按钮调用 `setCellMode`。`mode` prop 的开关只改变整张表，点击“清除 API 模式”后即可看到它的效果。

:::demo 使用 `edit` 插槽提供编辑控件，并分别演示表格、行、单元格三种模式范围。
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
const lastChange = ref('等待模式 API 操作')
const rows = ref<UserRow[]>([
  { id: 'U-001', name: '张三', status: '启用', department: '技术部' },
  { id: 'U-002', name: '李四', status: '停用', department: '产品部' },
  { id: 'U-003', name: '王五', status: '启用', department: '运营部' },
])
const columns: ConfigTableColumn[] = [
  { field: 'name', title: '姓名', minWidth: 150, slots: { edit: 'editName' } },
  { field: 'status', title: '状态', width: 120, slots: { edit: 'editStatus' } },
  { field: 'department', title: '部门', minWidth: 140 },
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
  tableRef.value?.setRowMode(({ row }) => row.status === '启用', 'edit')
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
    <ElButton type="primary" size="small" @click="applyTableMode">整表进入 edit</ElButton>
    <ElButton size="small" @click="applyRowMode">U-001 行进入 edit</ElButton>
    <ElButton size="small" @click="applyCellMode">U-002 / 状态单元格进入 edit</ElButton>
    <ElButton size="small" @click="applyActiveRowsMode">所有启用行进入 edit</ElButton>
    <ElButton size="small" @click="applyNameCellsMode">所有姓名单元格进入 edit</ElButton>
    <ElButton size="small" @click="tableRef?.clearAllModes()">清除 API 模式</ElButton>
    <span>mode prop：</span>
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
    width="100%"
    :height="220"
    @mode-change="handleModeChange"
  >
    <template #editName="{ row, clearCellMode }">
      <ElInput v-model="row.name" size="small" @keyup.enter="clearCellMode" />
    </template>
    <template #editStatus="{ row, clearCellMode }">
      <ElSelect v-model="row.status" size="small" @change="clearCellMode">
        <ElOption label="启用" value="启用" />
        <ElOption label="停用" value="停用" />
      </ElSelect>
    </template>
  </ConfigTable>
</template>
```
:::

有效的模式 API 变更会触发 `modeChange`；单项事件包含变更前后有效模式，批量事件包含清理数量。事件只用于状态观察，不会写回 `mode` prop。组件不提供内置编辑触发器，也不处理保存/取消、校验或行数据更新，这些行为由使用方实现。缺少 edit 插槽时，单元格保持原有渲染结果。

## 自定义单元格插槽

:::demo `column.slots.default` 可以是插槽名字符串，在模板中声明对应具名插槽进行自定义渲染。
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
  { field: 'name',   title: '姓名', minWidth: 140 },
  { field: 'status', title: '状态', width: 100, align: 'center', slots: { default: 'status' } },
  { field: 'score',  title: '分数', width: 100, align: 'right',  slots: { default: 'score'  } },
]
const data = shallowRef<ScoreRow[]>([
  { name: '张三', status: '启用', score: 92 },
  { name: '李四', status: '禁用', score: 67 },
  { name: '王五', status: '启用', score: 85 },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" :width="720" :height="200">
    <template #status="{ value }">
      <ElTag :type="value === '启用' ? 'success' : 'danger'" size="small">{{ value }}</ElTag>
    </template>
    <template #score="{ value }">
      <span :style="{ color: value >= 90 ? '#67c23a' : value >= 75 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
        {{ value }}
      </span>
    </template>
  </ConfigTable>
</template>
```
:::
