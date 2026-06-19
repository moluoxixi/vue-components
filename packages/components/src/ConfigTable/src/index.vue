<script setup lang="ts">
import type {
  ConfigTableCellParams,
  ConfigTableColumn,
  ConfigTableEmits,
  ConfigTableEmptyRender,
  ConfigTablePageChangeParams,
  ConfigTablePaginationProps,
  ConfigTableProps,
  ConfigTableRender,
  ConfigTableSlots,
  ConfigTableRow,
} from './types'
import { useRequestTable } from '@moluoxixi/hooks'
import { computed, defineComponent, watch } from 'vue'

const props = withDefaults(defineProps<ConfigTableProps>(), {
  columns: () => [],
  data: () => [],
  tableProps: () => ({}),
  emptyText: '暂无数据',
  currentRowIndex: -1,
  params: () => ({}),
  enabled: true,
  pagination: undefined,
  resetPageOnParamsChange: true,
})

const emit = defineEmits<ConfigTableEmits>()
const slots = defineSlots<ConfigTableSlots>()
const currentPage = defineModel<number>('currentPage', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })

const ConfigTableRenderNode = defineComponent({
  name: 'ConfigTableRenderNode',
  props: {
    params: { type: Object, required: true },
    render: { type: Function, required: true },
  },
  setup(renderProps) {
    return () => (renderProps.render as ConfigTableRender | ConfigTableEmptyRender)(renderProps.params as any)
  },
})

const tableProps = computed<Record<string, any>>(() => {
  return {
    border: true,
    stripe: false,
    ...props.tableProps,
  }
})

const requestTable = props.query
  ? useRequestTable<ConfigTableRow>({
      queryKey: props.cacheKey ?? 'ConfigTable',
      query: props.query,
      params: computed(() => props.params),
      currentPage,
      pageSize,
      enabled: computed(() => props.enabled),
      staleTime: props.staleTime,
      resetPageOnParamsChange: props.resetPageOnParamsChange,
    })
  : null

const tableData = computed<ConfigTableRow[]>(() => {
  return requestTable?.data.value ?? props.data
})

const requestTotal = computed<number>(() => requestTable?.total.value ?? tableData.value.length)

const isRequestLoading = computed<boolean>(() => {
  return Boolean(requestTable && (requestTable.isLoading.value || requestTable.isFetching.value))
})

const computedEmptyText = computed<string>(() => {
  if (isRequestLoading.value)
    return '加载中...'
  if (requestTable?.isError.value)
    return '加载失败'
  return props.emptyText
})

const shouldShowPagination = computed<boolean>(() => {
  return props.pagination !== false && (Boolean(props.pagination) || Boolean(requestTable))
})

const paginationProps = computed<ConfigTablePaginationProps>(() => {
  const defaults: ConfigTablePaginationProps = {
    layout: 'total, sizes, prev, pager, next, jumper',
  }
  return typeof props.pagination === 'object'
    ? { ...defaults, ...props.pagination }
    : defaults
})

if (requestTable) {
  watch(
    () => requestTable.query.data.value,
    (result) => {
      if (result)
        emit('loaded', result)
    },
  )

  watch(
    () => requestTable.error.value,
    (error) => {
      if (error)
        emit('error', error)
    },
  )
}

function getColumnLabel(column: ConfigTableColumn): string {
  return column.label ?? column.title ?? column.field
}

function getColumnMinWidth(column: ConfigTableColumn): string | number | undefined {
  return column.minWidth
}

function getColumnWidth(column: ConfigTableColumn): string | number | undefined {
  return column.width
}

function getCellValue(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number): any {
  const value = row[column.field]
  return column.formatter
    ? column.formatter({ row, column, rowIndex, columnIndex, value })
    : value
}

function isRender(slot: string | ConfigTableRender | undefined): slot is ConfigTableRender {
  return typeof slot === 'function'
}

function isSlotName(slot: string | ConfigTableRender | undefined): slot is string {
  return typeof slot === 'string'
}

function createHeaderParams(column: ConfigTableColumn, columnIndex: number) {
  return {
    column,
    columnIndex,
    columns: props.columns,
    data: tableData.value,
    index: columnIndex,
  }
}

function createSlotParams(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number) {
  return {
    row,
    column,
    rowIndex,
    columnIndex,
    columns: props.columns,
    data: tableData.value,
    index: rowIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
  }
}

function createCellParams(
  row: ConfigTableRow,
  column: ConfigTableColumn,
  rowIndex: number,
  columnIndex: number,
  event?: MouseEvent,
): ConfigTableCellParams {
  return {
    row,
    column,
    rowIndex,
    columnIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
    event,
  }
}

function handleCellClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, event: MouseEvent): void {
  emit('cellClick', createCellParams(row, column, rowIndex, columnIndex, event))
}

function handleCellDblClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, event: MouseEvent): void {
  emit('cellDblClick', createCellParams(row, column, rowIndex, columnIndex, event))
}

function emitPageChange(): void {
  const params: ConfigTablePageChangeParams = {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
  }
  emit('pageChange', params)
}

function handleCurrentPageUpdate(page: number): void {
  currentPage.value = page
  emitPageChange()
}

function handlePageSizeUpdate(size: number): void {
  pageSize.value = size
  currentPage.value = 1
  emitPageChange()
}
</script>

<template>
  <ElTable
    class="mx-config-table"
    :data="tableData"
    :empty-text="computedEmptyText"
    highlight-current-row
    v-bind="tableProps"
  >
    <ElTableColumn
      v-for="(column, columnIndex) in props.columns"
      :key="column.field"
      :prop="column.field"
      :label="getColumnLabel(column)"
      :width="getColumnWidth(column)"
      :min-width="getColumnMinWidth(column)"
      :align="column.align"
      v-bind="column.columnProps"
    >
      <template #header>
        <ConfigTableRenderNode
          v-if="isRender(column.slots?.header)"
          :render="column.slots.header"
          :params="createHeaderParams(column, columnIndex)"
        />
        <slot
          v-else-if="isSlotName(column.slots?.header) && slots[column.slots.header]"
          :name="column.slots.header"
          :column="column"
          :column-index="columnIndex"
          :columns="props.columns"
          :data="tableData"
          :index="columnIndex"
        />
        <template v-else>
          {{ getColumnLabel(column) }}
        </template>
      </template>
      <template #default="scope">
        <div
          class="mx-config-table__cell"
          :class="{ 'mx-config-table__cell--current': scope.$index === props.currentRowIndex }"
          :data-field="column.field"
          :data-testid="`config-table-cell-${column.field}-${scope.$index}`"
          @click="handleCellClick(scope.row, column, scope.$index, columnIndex, $event)"
          @dblclick="handleCellDblClick(scope.row, column, scope.$index, columnIndex, $event)"
        >
          <ConfigTableRenderNode
            v-if="isRender(column.slots?.default)"
            :render="column.slots.default"
            :params="createSlotParams(scope.row, column, scope.$index, columnIndex)"
          />
          <slot
            v-else-if="isSlotName(column.slots?.default) && slots[column.slots.default]"
            :name="column.slots.default"
            :row="scope.row"
            :column="column"
            :row-index="scope.$index"
            :column-index="columnIndex"
            :columns="props.columns"
            :data="tableData"
            :index="scope.$index"
            :value="getCellValue(scope.row, column, scope.$index, columnIndex)"
          />
          <template v-else>
            {{ getCellValue(scope.row, column, scope.$index, columnIndex) }}
          </template>
        </div>
      </template>
    </ElTableColumn>
    <template #empty>
      <ConfigTableRenderNode
        v-if="props.slots?.empty"
        :render="props.slots.empty"
        :params="{ columns: props.columns, data: tableData }"
      />
      <slot v-else name="empty">
        {{ computedEmptyText }}
      </slot>
    </template>
  </ElTable>
  <ElPagination
    v-if="shouldShowPagination"
    class="mx-config-table__pagination"
    :current-page="currentPage"
    :page-size="pageSize"
    :total="requestTotal"
    v-bind="paginationProps"
    @update:current-page="handleCurrentPageUpdate"
    @update:page-size="handlePageSizeUpdate"
  />
</template>

<style scoped>
.mx-config-table {
  width: 100%;
}

.mx-config-table__cell {
  width: 100%;
  min-height: 22px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.mx-config-table__cell--current {
  font-weight: 600;
}

.mx-config-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
