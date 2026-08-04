# PopoverTableSelect

输入框触发弹出表格的选择器，支持筛选数据并将选中行回填到输入框。

## 基础用法

:::demo 配置 `columns` 和 `data`，点击输入框弹出表格，点击行触发 `select` 事件。
```vue
<script setup>
import { computed, ref } from 'vue'

const inputValue = ref('C-001 华东仓')
const selectedRow = ref({ code: 'C-001', name: '华东仓', owner: '运营一部', status: '启用' })

const allRows = [
  { code: 'C-001', name: '华东仓', owner: '运营一部', status: '启用' },
  { code: 'C-002', name: '华南仓', owner: '运营二部', status: '启用' },
  { code: 'C-003', name: '西南仓', owner: '运营三部', status: '维护' },
  { code: 'C-004', name: '华北仓', owner: '运营四部', status: '启用' },
]

const columns = [
  { field: 'code',   title: '编码', width: 120 },
  { field: 'name',   title: '名称', minWidth: 150 },
  { field: 'owner',  title: '负责人', minWidth: 130 },
  { field: 'status', title: '状态',  width: 90, align: 'center', slots: { default: 'status' } },
]

const filteredRows = computed(() =>
  allRows.filter((row) => {
    const keyword = inputValue.value.replace(/\s+/g, '').toLowerCase()
    const searchable = `${row.code}${row.name}${row.owner}${row.status}`.toLowerCase()
    return searchable.includes(keyword)
  })
)

function handleSelect(row) {
  selectedRow.value = row
  inputValue.value = `${row.code} ${row.name}`
}
</script>
<template>
  <PopoverTableSelect
    v-model:input-value="inputValue"
    pop-type="input"
    width="auto"
    :data="filteredRows"
    :columns="columns"
    :height="200"
    placeholder="输入仓库编码或名称搜索"
    @select="handleSelect"
  >
    <template #status="{ value }">
      <ElTag :type="value === '启用' ? 'success' : 'warning'" size="small">{{ value }}</ElTag>
    </template>
  </PopoverTableSelect>

  <ElDescriptions :column="2" border style="margin-top:16px;">
    <ElDescriptionsItem label="编码">{{ selectedRow.code }}</ElDescriptionsItem>
    <ElDescriptionsItem label="名称">{{ selectedRow.name }}</ElDescriptionsItem>
    <ElDescriptionsItem label="负责人">{{ selectedRow.owner }}</ElDescriptionsItem>
    <ElDescriptionsItem label="状态">{{ selectedRow.status }}</ElDescriptionsItem>
  </ElDescriptions>
</template>
```
:::
