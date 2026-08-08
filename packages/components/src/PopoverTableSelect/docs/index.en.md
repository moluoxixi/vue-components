# PopoverTableSelect

A table selector opened from an input. It supports filtering rows and writing the selected record back to the input.

## Basic Usage

:::demo Configure `columns` and `data`, then handle the `select` event when the user chooses a row.
```vue
<script setup>
import { PopoverTableSelect } from '@moluoxixi/components'
import { ElTag } from 'element-plus'
import { computed, ref } from 'vue'

const inputValue = ref('W-001 East Warehouse')
const rows = [
  { code: 'W-001', name: 'East Warehouse', owner: 'Operations A', status: 'Active' },
  { code: 'W-002', name: 'South Warehouse', owner: 'Operations B', status: 'Active' },
  { code: 'W-003', name: 'West Warehouse', owner: 'Operations C', status: 'Maintenance' },
]
const columns = [
  { field: 'code', title: 'Code', width: 120 },
  { field: 'name', title: 'Name', minWidth: 160 },
  { field: 'owner', title: 'Owner', minWidth: 140 },
  { field: 'status', title: 'Status', width: 120, slots: { default: 'status' } },
]
const filteredRows = computed(() => {
  const keyword = inputValue.value.toLowerCase()
  return rows.filter(row => `${row.code} ${row.name} ${row.owner} ${row.status}`.toLowerCase().includes(keyword))
})

function handleSelect(row) {
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
    placeholder="Search by warehouse code or name"
    @select="handleSelect"
  >
    <template #status="{ value }">
      <ElTag :type="value === 'Active' ? 'success' : 'warning'" size="small">{{ value }}</ElTag>
    </template>
  </PopoverTableSelect>
</template>
```
:::
