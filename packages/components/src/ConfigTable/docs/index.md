# ConfigTable

基于 Element Plus `ElTableV2` 的高性能虚拟滚动配置式表格，支持远程请求、分页、自定义渲染与插槽。

## 基础用法

:::demo 传入 `columns` 配置和静态 `data`，即可渲染虚拟列表表格。
```vue
<script setup>
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

:::demo `cellRender` / `headerRender` 使用与 HeadlessTable 相同的命名 renderer 协议；开启 `columnConfig` 后，可在弹窗中拖拽排序或显示隐藏列。
```vue
<script setup>
import { ConfigTable, defineHeadlessTableRenderer } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { h, ref, shallowRef } from 'vue'

const columnOrder = ref([])
const columnVisibility = ref({})
const renderers = {
  status: defineHeadlessTableRenderer({
    renderDefault: (renderOptions, { rawValue }) => h(
      ElTag,
      {
        size: 'small',
        type: rawValue === '启用' ? 'success' : 'warning',
      },
      () => `${renderOptions.props?.prefix ?? ''}${rawValue}`,
    ),
  }),
  scoreHeader: defineHeadlessTableRenderer({
    renderHeader: (_, { column }) => h('strong', { style: 'color:#409eff' }, column.title),
  }),
}
const columns = [
  { field: 'name', title: '姓名', minWidth: 140, slots: { header: 'nameHeader' } },
  {
    field: 'status',
    title: '状态',
    width: 110,
    align: 'center',
    cellRender: { name: 'status', props: { prefix: '账号' } },
  },
  {
    field: 'score',
    title: '分数',
    width: 100,
    align: 'right',
    headerRender: 'scoreHeader',
    formatter: ({ value }) => `${value} 分`,
  },
]
const data = shallowRef([
  { name: '张三', status: '启用', score: 92 },
  { name: '李四', status: '维护', score: 78 },
  { name: '王五', status: '启用', score: 85 },
])
</script>

<template>
  <ConfigTable
    v-model:column-order="columnOrder"
    v-model:column-visibility="columnVisibility"
    :columns="columns"
    :data="data"
    :renderers="renderers"
    :width="720"
    :height="200"
    column-config
  >
    <template #nameHeader>
      <strong>姓名（Slot）</strong>
    </template>
  </ConfigTable>
</template>
```
:::

列内容的优先级为：列内联渲染函数或具名 Slot、命名 renderer、`formatter`、原始字段值。`column.id` 是列设置使用的稳定标识，未提供时使用 `field`。

## 远程请求 + 分页

:::demo 传入 `query` 函数，组件自动发请求并展示分页栏。
```vue
<script setup>
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

## 自定义单元格插槽

:::demo `column.slots.default` 可以是插槽名字符串，在模板中声明对应具名插槽进行自定义渲染。
```vue
<script setup>
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
