# ConfigTable

A high-performance, configuration-driven virtual table built on Element Plus `ElTableV2`. It supports remote data, pagination, custom renderers, and slots.

## Basic Usage

:::demo Provide `columns` and static `data` to render a virtualized table.
```vue
<script setup>
import { ConfigTable } from '@moluoxixi/components'
import { shallowRef } from 'vue'

const columns = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'department', title: 'Department', minWidth: 140 },
  { field: 'role', title: 'Role', minWidth: 150 },
]
const data = shallowRef([
  { id: 1, name: 'Avery', department: 'Engineering', role: 'Frontend Engineer' },
  { id: 2, name: 'Blake', department: 'Product', role: 'Product Manager' },
  { id: 3, name: 'Casey', department: 'Operations', role: 'Operations Specialist' },
  { id: 4, name: 'Drew', department: 'Engineering', role: 'Backend Engineer' },
])
</script>
<template>
  <ConfigTable :columns="columns" :data="data" :width="720" :height="240" />
</template>
```
:::

## Renderer and Column Settings

:::demo Register a named renderer once and reuse it across table instances. Enable `columnConfig` to let users reorder, resize, show, or hide columns.
```vue
<script setup>
import { ConfigTable, defineHeadlessTableRenderer, headlessTableRenderer } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { h, ref, shallowRef } from 'vue'

const columnOrder = ref([])
const columnVisibility = ref({})
const columnWidths = ref({})

headlessTableRenderer.replace('docs-config-status-en', defineHeadlessTableRenderer({
  renderDefault: (_, { rawValue }) => h(
    ElTag,
    { size: 'small', type: rawValue === 'Active' ? 'success' : 'warning' },
    () => rawValue,
  ),
}))

const columns = [
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
const data = shallowRef([
  { name: 'Avery', status: 'Active', score: 92 },
  { name: 'Blake', status: 'Maintenance', score: 78 },
  { name: 'Casey', status: 'Active', score: 85 },
])
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
  />
</template>
```
:::

Column content resolves in this order: an inline renderer or named slot, a named renderer, `formatter`, and finally the raw field value. `column.id` is the stable key used by column settings; when omitted, `field` is used.

## Remote Data and Pagination

:::demo Provide a `query` function to load data and display the pagination controls automatically.
```vue
<script setup>
import { ConfigTable } from '@moluoxixi/components'

const columns = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'status', title: 'Status', width: 100, align: 'center' },
]

async function queryUsers({ currentPage, pageSize }) {
  await new Promise(resolve => setTimeout(resolve, 200))
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

## Custom Cell Slots

:::demo Set `column.slots.default` to a slot name and provide the matching named slot in the template.
```vue
<script setup>
import { ConfigTable } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { shallowRef } from 'vue'

const columns = [
  { field: 'name', title: 'Name', minWidth: 140 },
  { field: 'status', title: 'Status', width: 100, align: 'center', slots: { default: 'status' } },
  { field: 'score', title: 'Score', width: 100, align: 'right', slots: { default: 'score' } },
]
const data = shallowRef([
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
