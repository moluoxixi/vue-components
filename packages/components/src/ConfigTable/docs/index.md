# ConfigTable

基于 Element Plus `ElTableV2` 的高性能虚拟滚动配置式表格，支持远程请求、分页、自定义渲染与插槽。

## 基础用法

:::demo 传入 `columns` 配置和静态 `data`，即可渲染虚拟列表表格。
```vue
<script setup lang="ts">
import { ConfigTable } from '@moluoxixi/components'
import { shallowRef } from 'vue'

const columns = [
  { field: 'id',   title: 'ID',   width: 80 },
  { field: 'name', title: '姓名', minWidth: 140 },
  { field: 'dept', title: '部门', minWidth: 140 },
  { field: 'role', title: '角色', minWidth: 120 },
]
const data = shallowRef([
  { id: 1, name: '张三', dept: '技术部', role: '前端工程师' },
  { id: 2, name: '李四', dept: '产品部', role: '产品经理' },
  { id: 3, name: '王五', dept: '运营部', role: '运营专员' },
  { id: 4, name: '赵六', dept: '技术部', role: '后端工程师' },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" :width="720" :height="240" />
</template>
```
:::

## Renderer 与列设置

:::demo renderer 可以在应用级 registry 中注册一次，ConfigTable 和 HeadlessTable 的多个实例都能复用；开启 `columnConfig` 后，可在弹窗中拖拽排序、调整宽度或显示隐藏列。
```vue
<script setup lang="ts">
import { ConfigTable, defineHeadlessTableRenderer, headlessTableRenderer } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { h, ref, shallowRef } from 'vue'

const columnOrder = ref([])
const columnVisibility = ref({})
const columnWidths = ref({})
headlessTableRenderer.replace('docs-config-status', defineHeadlessTableRenderer({
  renderDefault: (renderOptions, { rawValue }) => h(
    ElTag,
    {
      size: 'small',
      type: rawValue === '启用' ? 'success' : 'warning',
    },
    () => `${renderOptions.props?.prefix ?? ''}${rawValue}`,
  ),
}))
headlessTableRenderer.replace('docs-config-score-header', defineHeadlessTableRenderer({
  renderHeader: (_, { column }) => h('strong', { style: 'color:#409eff' }, column.title),
}))
const columns = [
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
const data = shallowRef([
  { name: '张三', status: '启用', score: 92 },
  { name: '李四', status: '维护', score: 78 },
  { name: '王五', status: '启用', score: 85 },
])
const secondData = shallowRef([
  { name: '赵六', status: '启用', score: 88 },
])
const secondaryColumns = columns.map(column => ({ ...column, slots: undefined }))
</script>

<template>
  <ConfigTable
    v-model:column-order="columnOrder"
    v-model:column-visibility="columnVisibility"
    v-model:column-widths="columnWidths"
    :columns="columns"
    :data="data"
    :width="720"
    :height="200"
    column-config
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

## 远程请求 + 分页

:::demo 传入 `query` 函数，组件自动发请求并展示分页栏。
```vue
<script setup lang="ts">
import { ConfigTable } from '@moluoxixi/components'

const columns = [
  { field: 'id',     title: 'ID',   width: 80 },
  { field: 'name',   title: '姓名', minWidth: 140 },
  { field: 'status', title: '状态', width: 100, align: 'center' },
]

async function queryUsers({ currentPage, pageSize }) {
  await new Promise(r => setTimeout(r, 200))
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

行和单元格 API 必须使用稳定行标识，可传入 `getRowId`，或配置显式 `rowKey`。`columns[].slots.edit` 支持内联渲染函数和具名插槽名称。插槽作用域包含 `mode`、`rowId`、行列上下文和当前行/单元格的模式操作。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ConfigTable } from '@moluoxixi/components'
import { ElInput } from 'element-plus'

const tableRef = ref()
const rows = ref([
  { id: 'U-001', name: '张三', status: '启用' },
  { id: 'U-002', name: '李四', status: '停用' },
])
const columns = [
  { field: 'name', title: '姓名', slots: { edit: 'editName' } },
  { field: 'status', title: '状态' },
]
</script>

<template>
  <ConfigTable ref="tableRef" :columns="columns" :data="rows" row-key="id">
    <template #editName="{ row, clearCellMode }">
      <ElInput v-model="row.name" @keyup.enter="clearCellMode" />
    </template>
  </ConfigTable>
</template>
```

```ts
tableRef.value?.setMode('edit')
tableRef.value?.setRowMode('U-001', 'edit')
tableRef.value?.setCellMode('U-002', 'name', 'edit')
tableRef.value?.clearAllModes()
```

有效的模式 API 变更会触发 `modeChange`；单项事件包含变更前后有效模式，批量事件包含清理数量。事件只用于状态观察，不会写回 `mode` prop。组件不提供内置编辑触发器，也不处理保存/取消、校验或行数据更新，这些行为由使用方实现。缺少 edit 插槽时，单元格保持原有渲染结果。

## 自定义单元格插槽

:::demo `column.slots.default` 可以是插槽名字符串，在模板中声明对应具名插槽进行自定义渲染。
```vue
<script setup lang="ts">
import { ConfigTable } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { shallowRef } from 'vue'

const columns = [
  { field: 'name',   title: '姓名', minWidth: 140 },
  { field: 'status', title: '状态', width: 100, align: 'center', slots: { default: 'status' } },
  { field: 'score',  title: '分数', width: 100, align: 'right',  slots: { default: 'score'  } },
]
const data = shallowRef([
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
