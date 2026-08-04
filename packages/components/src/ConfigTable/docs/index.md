# ConfigTable

基于 Element Plus `ElTableV2` 的高性能虚拟滚动配置式表格，支持远程请求、分页、自定义渲染与插槽。

## 基础用法

:::demo 传入 `columns` 配置和静态 `data`，即可渲染虚拟列表表格。
```vue
<script setup>
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

## 远程请求 + 分页

:::demo 传入 `query` 函数，组件自动发请求并展示分页栏。
```vue
<script setup>
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
