<script lang="ts">
export const exampleMeta = {
  name: 'HeadlessTable',
  title: 'HeadlessTable',
  category: '数据展示',
  description: '由无样式的表格内核驱动 Element Plus Table，列、renderer 和 slots 均由配置控制。',
  order: 25,
}
</script>

<script setup lang="ts">
import type { HeadlessTableColumn } from '@moluoxixi/components'
import { HeadlessTable, headlessTableRenderer } from '@moluoxixi/components'
import { ElButton, ElTag } from 'element-plus'
import { computed, h, ref } from 'vue'

interface WarehouseRow {
  code: string
  name: string
  owner: { name: string, team: string }
  utilization: number
  status: '启用' | '维护'
}

const keyword = ref('')
const visibleFields = ref(['code', 'name', 'owner.name', 'utilization', 'status', 'actions'])
const selectedCode = ref('未选择')

const rows: WarehouseRow[] = [
  { code: 'C-001', name: '华东仓', owner: { name: '陈晨', team: '运营一部' }, utilization: 82, status: '启用' },
  { code: 'C-002', name: '华南仓', owner: { name: '林晓', team: '运营二部' }, utilization: 67, status: '启用' },
  { code: 'C-003', name: '西南仓', owner: { name: '周宁', team: '运营三部' }, utilization: 91, status: '维护' },
  { code: 'C-004', name: '华北仓', owner: { name: '赵新', team: '运营四部' }, utilization: 74, status: '启用' },
]

headlessTableRenderer.add<WarehouseRow>('statusTag', {
  renderDefault(renderOptions, { value }) {
    return h(ElTag, {
      effect: 'light',
      size: 'small',
      type: value === '启用' ? 'success' : 'warning',
      ...renderOptions.props,
    }, () => value)
  },
})

const baseColumns: HeadlessTableColumn<WarehouseRow>[] = [
  { field: 'code', title: '仓库编码', width: 120, columnProps: { fixed: 'left' } },
  { field: 'name', title: '仓库名称', minWidth: 150 },
  {
    field: 'owner.name',
    title: '负责人',
    minWidth: 170,
    slots: { default: 'owner' },
  },
  {
    field: 'utilization',
    title: '库容利用率',
    width: 140,
    align: 'right',
    formatter: ({ value }) => `${value}%`,
    slots: { header: 'utilizationHeader' },
  },
  {
    field: 'status',
    title: '状态',
    width: 100,
    align: 'center',
    cellRender: { name: 'statusTag', props: { round: true } },
  },
  {
    field: 'actions',
    title: '操作',
    width: 90,
    align: 'center',
    columnProps: { fixed: 'right' },
    slots: {
      default: ({ row }) => h(ElButton, {
        link: true,
        type: 'primary',
        onClick: () => selectedCode.value = row.code,
      }, () => '查看'),
    },
  },
]

const columns = computed(() => baseColumns.map(column => ({
  ...column,
  visible: visibleFields.value.includes(column.field),
})))

const filteredRows = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query)
    return rows

  return rows.filter(row => [row.code, row.name, row.owner.name, row.owner.team, row.status]
    .some(value => value.toLowerCase().includes(query)))
})
</script>

<template>
  <div class="headless-table-example" data-testid="headless-table-example">
    <div class="headless-table-example__toolbar">
      <ElInput
        v-model="keyword"
        clearable
        placeholder="搜索仓库、负责人或状态"
        data-testid="headless-table-search"
      />
      <ElCheckboxGroup v-model="visibleFields" class="headless-table-example__columns">
        <ElCheckbox value="code">
          编码
        </ElCheckbox>
        <ElCheckbox value="owner.name">
          负责人
        </ElCheckbox>
        <ElCheckbox value="utilization">
          利用率
        </ElCheckbox>
        <ElCheckbox value="status">
          状态
        </ElCheckbox>
      </ElCheckboxGroup>
    </div>

    <HeadlessTable :columns="columns" :data="filteredRows" empty-text="没有匹配的仓库">
      <template #default="{ columns: tableColumns, data, Cell, Header, Empty, getColumnLabel }">
        <ElTable :data="data" border stripe row-key="code" data-testid="headless-element-table">
          <ElTableColumn
            v-for="(column, columnIndex) in tableColumns"
            :key="column.field"
            :prop="column.field"
            :label="getColumnLabel(column)"
            :width="column.width"
            :min-width="column.minWidth"
            :align="column.align"
            v-bind="column.columnProps"
          >
            <template #header>
              <component :is="Header" :column="column" :column-index="columnIndex" />
            </template>
            <template #default="{ row, $index }">
              <component
                :is="Cell"
                :row="row"
                :column="column"
                :row-index="$index"
                :column-index="columnIndex"
              />
            </template>
          </ElTableColumn>
          <template #empty>
            <component :is="Empty" />
          </template>
        </ElTable>
      </template>

      <template #owner="{ row, value }">
        <div class="headless-table-example__owner">
          <span>{{ value }}</span>
          <small>{{ row.owner.team }}</small>
        </div>
      </template>

      <template #utilizationHeader>
        <ElTooltip content="当前已使用库容占总库容的比例" placement="top">
          <span class="headless-table-example__help">利用率</span>
        </ElTooltip>
      </template>
    </HeadlessTable>

    <div class="headless-table-example__selection" aria-live="polite">
      当前选择：<strong data-testid="headless-table-selected">{{ selectedCode }}</strong>
    </div>
  </div>
</template>

<style scoped lang="scss">
.headless-table-example {
  width: 100%;
}

.headless-table-example__toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.headless-table-example__toolbar :deep(.el-input) {
  width: min(320px, 100%);
}

.headless-table-example__columns {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.headless-table-example__owner {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.headless-table-example__owner small {
  color: var(--el-text-color-secondary);
}

.headless-table-example__help {
  border-bottom: 1px dotted var(--el-text-color-secondary);
  cursor: help;
}

.headless-table-example__selection {
  margin-top: 12px;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

@media (max-width: 780px) {
  .headless-table-example__toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .headless-table-example__columns {
    justify-content: flex-start;
  }
}
</style>
