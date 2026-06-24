<script setup lang="ts">
import type { Column as TableV2Column } from 'element-plus'
import type {
  ConfigTableCellParams,
  ConfigTableColumn,
  ConfigTableEmits,
  ConfigTableEmptyRender,
  ConfigTablePageChangeParams,
  ConfigTablePaginationProps,
  ConfigTableProps,
  ConfigTableRender,
  ConfigTableRow,
  ConfigTableRowClass,
  ConfigTableRowClassParams,
  ConfigTableSlots,
} from './types'
import { useRequestTable } from '@moluoxixi/hooks'
import { computed, defineComponent, watch } from 'vue'

const INTERNAL_ROW_KEY = '__mx_config_table_row_key'

interface ConfigTableVirtualColumn extends TableV2Column<ConfigTableRow> {
  configColumn: ConfigTableColumn
  configColumnIndex: number
}

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
  width: 800,
  height: 320,
  rowHeight: 44,
  headerHeight: 40,
  defaultColumnWidth: 160,
  rowKey: INTERNAL_ROW_KEY,
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

const virtualRows = computed<ConfigTableRow[]>(() => {
  if (props.rowKey !== INTERNAL_ROW_KEY)
    return tableData.value

  return tableData.value.map((row, rowIndex) => ({
    ...row,
    [INTERNAL_ROW_KEY]: rowIndex,
  }))
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

const virtualColumns = computed<ConfigTableVirtualColumn[]>(() => {
  return props.columns.map((column, columnIndex) => {
    const columnProps = column.columnProps ?? {}

    return {
      ...columnProps,
      align: column.align ?? columnProps.align,
      class: columnProps.class ?? columnProps.className,
      configColumn: column,
      configColumnIndex: columnIndex,
      dataKey: columnProps.dataKey ?? column.field,
      key: columnProps.key ?? column.field,
      minWidth: getColumnMinWidth(column),
      title: getColumnLabel(column),
      width: getColumnWidth(column),
    } as ConfigTableVirtualColumn
  })
})

const virtualTableProps = computed<Record<string, any>>(() => {
  const {
    columns: _columns,
    data: _data,
    headerHeight: _headerHeight,
    height: _height,
    rowClass: _rowClass,
    rowClassName: _rowClassName,
    rowHeight: _rowHeight,
    rowKey: _rowKey,
    width: _width,
    ...rest
  } = props.tableProps as Record<string, any>

  return {
    ...rest,
    rowClass: resolveRowClass,
  }
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

function toNumberSize(value: number | string | undefined, fallback?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value))
    return value

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i)
    if (match)
      return Number(match[1])
  }

  return fallback
}

function getColumnMinWidth(column: ConfigTableColumn): number | undefined {
  return toNumberSize(column.minWidth ?? column.columnProps?.minWidth)
}

function getColumnWidth(column: ConfigTableColumn): number {
  return toNumberSize(
    column.width ?? column.columnProps?.width ?? column.minWidth ?? column.columnProps?.minWidth,
    props.defaultColumnWidth,
  ) ?? props.defaultColumnWidth
}

function getRawRow(rowData: ConfigTableRow, rowIndex: number): ConfigTableRow {
  return tableData.value[rowIndex] ?? rowData
}

function getConfigColumn(column: TableV2Column<ConfigTableRow>, columnIndex: number): ConfigTableColumn {
  return (column as ConfigTableVirtualColumn).configColumn ?? props.columns[columnIndex]
}

function getConfigColumnIndex(column: TableV2Column<ConfigTableRow>, columnIndex: number): number {
  return (column as ConfigTableVirtualColumn).configColumnIndex ?? columnIndex
}

function getColumnSlot(
  column: TableV2Column<ConfigTableRow>,
  columnIndex: number,
  slotName: 'default' | 'header',
): string | ConfigTableRender | undefined {
  return getConfigColumn(column, columnIndex).slots?.[slotName]
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

function createVirtualHeaderParams(column: TableV2Column<ConfigTableRow>, columnIndex: number) {
  const configColumn = getConfigColumn(column, columnIndex)
  const configColumnIndex = getConfigColumnIndex(column, columnIndex)
  return createHeaderParams(configColumn, configColumnIndex)
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

function createVirtualSlotParams(
  rowData: ConfigTableRow,
  column: TableV2Column<ConfigTableRow>,
  rowIndex: number,
  columnIndex: number,
) {
  const row = getRawRow(rowData, rowIndex)
  const configColumn = getConfigColumn(column, columnIndex)
  const configColumnIndex = getConfigColumnIndex(column, columnIndex)
  return createSlotParams(row, configColumn, rowIndex, configColumnIndex)
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

function handleVirtualCellClick(
  rowData: ConfigTableRow,
  column: TableV2Column<ConfigTableRow>,
  rowIndex: number,
  columnIndex: number,
  event: MouseEvent,
): void {
  const row = getRawRow(rowData, rowIndex)
  const configColumn = getConfigColumn(column, columnIndex)
  const configColumnIndex = getConfigColumnIndex(column, columnIndex)
  handleCellClick(row, configColumn, rowIndex, configColumnIndex, event)
}

function handleVirtualCellDblClick(
  rowData: ConfigTableRow,
  column: TableV2Column<ConfigTableRow>,
  rowIndex: number,
  columnIndex: number,
  event: MouseEvent,
): void {
  const row = getRawRow(rowData, rowIndex)
  const configColumn = getConfigColumn(column, columnIndex)
  const configColumnIndex = getConfigColumnIndex(column, columnIndex)
  handleCellDblClick(row, configColumn, rowIndex, configColumnIndex, event)
}

function resolveRowClass(params: { columns: TableV2Column<ConfigTableRow>[], rowData: ConfigTableRow, rowIndex: number }): string {
  const rowClass = (props.tableProps as { rowClass?: ConfigTableRowClass, rowClassName?: ConfigTableRowClass }).rowClass
    ?? (props.tableProps as { rowClassName?: ConfigTableRowClass }).rowClassName
  const rowClassParams: ConfigTableRowClassParams = {
    columns: props.columns,
    rowData: getRawRow(params.rowData, params.rowIndex),
    rowIndex: params.rowIndex,
  }
  const customClass = typeof rowClass === 'function'
    ? rowClass(rowClassParams)
    : rowClass
  const currentClass = params.rowIndex === props.currentRowIndex ? 'mx-config-table__row--current' : ''

  return [customClass, currentClass].filter(Boolean).join(' ')
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
  <ElTableV2
    class="mx-config-table"
    v-bind="virtualTableProps"
    :columns="virtualColumns"
    :data="virtualRows"
    :header-height="props.headerHeight"
    :height="props.height"
    :row-height="props.rowHeight"
    :row-key="props.rowKey"
    :width="props.width"
  >
    <template #header-cell="{ column, columnIndex }">
      <ConfigTableRenderNode
        v-if="isRender(getColumnSlot(column, columnIndex, 'header'))"
        :render="getColumnSlot(column, columnIndex, 'header') as ConfigTableRender"
        :params="createVirtualHeaderParams(column, columnIndex)"
      />
      <slot
        v-else-if="isSlotName(getColumnSlot(column, columnIndex, 'header')) && slots[getColumnSlot(column, columnIndex, 'header') as string]"
        :name="getColumnSlot(column, columnIndex, 'header') as string"
        v-bind="createVirtualHeaderParams(column, columnIndex)"
      />
      <template v-else>
        {{ getColumnLabel(getConfigColumn(column, columnIndex)) }}
      </template>
    </template>
    <template #cell="{ rowData, rowIndex, column, columnIndex }">
      <div
        class="mx-config-table__cell"
        :class="{ 'mx-config-table__cell--current': rowIndex === props.currentRowIndex }"
        :data-field="getConfigColumn(column, columnIndex).field"
        :data-testid="`config-table-cell-${getConfigColumn(column, columnIndex).field}-${rowIndex}`"
        @click="handleVirtualCellClick(rowData, column, rowIndex, columnIndex, $event)"
        @dblclick="handleVirtualCellDblClick(rowData, column, rowIndex, columnIndex, $event)"
      >
        <ConfigTableRenderNode
          v-if="isRender(getColumnSlot(column, columnIndex, 'default'))"
          :render="getColumnSlot(column, columnIndex, 'default') as ConfigTableRender"
          :params="createVirtualSlotParams(rowData, column, rowIndex, columnIndex)"
        />
        <slot
          v-else-if="isSlotName(getColumnSlot(column, columnIndex, 'default')) && slots[getColumnSlot(column, columnIndex, 'default') as string]"
          :name="getColumnSlot(column, columnIndex, 'default') as string"
          v-bind="createVirtualSlotParams(rowData, column, rowIndex, columnIndex)"
        />
        <template v-else>
          {{ createVirtualSlotParams(rowData, column, rowIndex, columnIndex).value }}
        </template>
      </div>
    </template>
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
  </ElTableV2>
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

.mx-config-table__cell--current,
:deep(.mx-config-table__row--current) .mx-config-table__cell {
  font-weight: 600;
}

.mx-config-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
