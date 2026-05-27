<script lang="ts">
// 示例元信息由 playground 通过 import.meta.glob 读取，用于生成侧栏和页面标题。
export const exampleMeta = {
  name: 'PopoverTableSelect',
  title: 'PopoverTableSelect',
  category: '弹层选择',
  description: '输入框触发弹层表格、筛选数据并回填选中行的场景。',
  order: 30,
}
</script>

<script setup lang="ts">
import type { PopoverTableColumn, PopoverTableRow } from '@moluoxixi/components'
import { PopoverTableSelect } from '@moluoxixi/components'
import { computed, shallowRef } from 'vue'

const inputValue = shallowRef('')
const selectedRow = shallowRef<PopoverTableRow>({
  code: 'C-001',
  name: '华东仓',
  owner: '运营一部',
  status: '启用',
})

const rows: PopoverTableRow[] = [
  { code: 'C-001', name: '华东仓', owner: '运营一部', status: '启用' },
  { code: 'C-002', name: '华南仓', owner: '运营二部', status: '启用' },
  { code: 'C-003', name: '西南仓', owner: '运营三部', status: '维护' },
  { code: 'C-004', name: '华北仓', owner: '运营四部', status: '启用' },
]

const columns: PopoverTableColumn[] = [
  { field: 'code', title: '编码', width: 120 },
  { field: 'name', title: '名称', minWidth: 160 },
  { field: 'owner', title: '负责人', minWidth: 140 },
  {
    field: 'status',
    title: '状态',
    width: 100,
    align: 'center',
    slots: { default: 'status' },
  },
]

const filteredRows = computed<PopoverTableRow[]>(() => {
  return rows.filter((row) => {
    return `${row.code}${row.name}${row.owner}${row.status}`.includes(inputValue.value)
  })
})

function handleSelect(row: PopoverTableRow): void {
  selectedRow.value = row
  inputValue.value = `${row.code} ${row.name}`
}
</script>

<template>
  <div class="popover-table-example" data-testid="popover-table-example">
    <PopoverTableSelect
      v-model:input-value="inputValue"
      pop-type="input"
      data-testid="popover-table-select"
      width="560"
      :data="filteredRows"
      :columns="columns"
      :height="240"
      :input-props="{ size: 'large' }"
      placeholder="输入仓库编码或名称"
      @select="handleSelect"
    >
      <template #status="{ value }">
        <ElTag :type="value === '启用' ? 'success' : 'warning'" size="small">
          {{ value }}
        </ElTag>
      </template>
    </PopoverTableSelect>

    <ElDivider />

    <ElDescriptions :column="2" border>
      <ElDescriptionsItem label="编码">
        <span data-testid="popover-selected-code">{{ selectedRow.code }}</span>
      </ElDescriptionsItem>
      <ElDescriptionsItem label="名称">
        <span data-testid="popover-selected-name">{{ selectedRow.name }}</span>
      </ElDescriptionsItem>
      <ElDescriptionsItem label="负责人">
        <span data-testid="popover-selected-owner">{{ selectedRow.owner }}</span>
      </ElDescriptionsItem>
      <ElDescriptionsItem label="状态">
        <span data-testid="popover-selected-status">{{ selectedRow.status }}</span>
      </ElDescriptionsItem>
    </ElDescriptions>
  </div>
</template>

<style scoped lang="scss">
.popover-table-example {
  max-width: 760px;
}
</style>
