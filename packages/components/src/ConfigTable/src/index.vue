<script setup lang="ts">
import type { Column as TableV2Column } from 'element-plus'
import type {
  ConfigTableCellParams,
  ConfigTableColumn,
  ConfigTableColumnConfig,
  ConfigTableColumnSettingChange,
  ConfigTableEmits,
  ConfigTablePageChangeParams,
  ConfigTablePaginationProps,
  ConfigTableProps,
  ConfigTableRow,
  ConfigTableRowClass,
  ConfigTableRowClassParams,
  ConfigTableSlots,
} from './types'
import type {
  HeadlessTableCellScope,
  HeadlessTableColumn,
  HeadlessTableHeaderScope,
} from '../../HeadlessTable/src/types'
import { useRequestTable } from '@moluoxixi/hooks'
import { ElPagination, ElTableV2 } from 'element-plus'
import { computed, defineComponent, inject, onBeforeUpdate, ref, shallowRef, watch } from 'vue'
import { projectHeadlessTableColumns } from '../../HeadlessTable/src/core'
import {
  headlessTableRenderer,
  headlessTableRendererKey,
  resolveHeadlessTableRenderer,
} from '../../HeadlessTable/src/renderer'
import ConfigTableColumnSettings from './ColumnSettings.vue'

const props = withDefaults(defineProps<ConfigTableProps>(), {
  columns: () => [],
  columnConfig: false,
  columnOrder: () => [],
  columnVisibility: () => ({}),
  data: () => [],
  diagnostics: true,
  tableProps: () => ({}),
  emptyText: '暂无数据',
  currentRowIndex: -1,
  params: () => ({}),
  enabled: true,
  pagination: undefined,
  resetPageOnParamsChange: true,
  renderers: () => ({}),
  width: 800,
  height: 320,
  rowHeight: 44,
  headerHeight: 40,
  defaultColumnWidth: 160,
  rowKey: '__mx_config_table_row_key',
})

const emit = defineEmits<ConfigTableEmits>()

const slots = defineSlots<ConfigTableSlots>()
const slotsVersion = shallowRef(0)
const warnedDiagnostics = new Set<string>()
const injectedRendererRegistry = inject(headlessTableRendererKey, null)

function captureSlots(): Record<string, unknown> {
  return Object.fromEntries(Object.keys(slots).map(name => [name, slots[name]]))
}

let slotSnapshot = captureSlots()

onBeforeUpdate(() => {
  const nextSnapshot = captureSlots()
  const previousKeys = Object.keys(slotSnapshot)
  const nextKeys = Object.keys(nextSnapshot)
  const changed = previousKeys.length !== nextKeys.length
    || nextKeys.some(name => slotSnapshot[name] !== nextSnapshot[name])

  if (changed) {
    slotSnapshot = nextSnapshot
    slotsVersion.value += 1
  }
})

const INTERNAL_ROW_KEY = '__mx_config_table_row_key'

interface ConfigTableVirtualColumn extends TableV2Column<ConfigTableRow> {
  configColumn: ConfigTableColumn
  configColumnIndex: number
  visibleColumnIndex: number
}

const currentPage = defineModel<number>('currentPage', { default: 1 })
const pageSize = defineModel<number>('pageSize', { default: 10 })
const columnOrderState = ref<string[]>([...props.columnOrder])
const columnVisibilityState = ref<Record<string, boolean>>({ ...props.columnVisibility })

const ConfigTableRenderNode = defineComponent({
  name: 'ConfigTableRenderNode',
  props: {
    params: { type: Object, required: true },
    render: { type: Function, required: true },
  },
  setup(renderProps) {
    return () => (renderProps.render as (params: any) => any)(renderProps.params)
  },
})

const normalizedColumnConfig = computed<ConfigTableColumnConfig>(() => ({
  buttonText: '列设置',
  draggable: true,
  title: '列设置',
  width: 440,
  ...(typeof props.columnConfig === 'object' ? props.columnConfig : {}),
}))

const columnConfigEnabled = computed(() => props.columnConfig !== false)

watch(() => props.columnOrder, (value) => {
  columnOrderState.value = [...value]
}, { deep: true })

watch(() => props.columnVisibility, (value) => {
  columnVisibilityState.value = { ...value }
}, { deep: true })

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

const columnProjection = computed(() => projectHeadlessTableColumns(
  props.columns as HeadlessTableColumn<ConfigTableRow>[],
  columnOrderState.value,
  columnVisibilityState.value,
))

const orderedColumns = computed<ConfigTableColumn[]>(() => (
  columnProjection.value.allColumns.map(item => item.column as ConfigTableColumn)
))

const visibleColumns = computed<ConfigTableColumn[]>(() => (
  columnProjection.value.columns.map(item => item.column as ConfigTableColumn)
))

const virtualColumns = computed<ConfigTableVirtualColumn[]>(() => {
  return columnProjection.value.columns.map(({ column: projectedColumn, sourceIndex }, visibleColumnIndex) => {
    const column = projectedColumn as ConfigTableColumn
    const columnProps = column.columnProps ?? {}

    return {
      ...columnProps,
      align: column.align ?? columnProps.align,
      class: columnProps.class ?? columnProps.className,
      configColumn: column,
      configColumnIndex: sourceIndex,
      dataKey: columnProps.dataKey ?? column.field,
      key: columnProps.key ?? column.field,
      minWidth: getColumnMinWidth(column),
      title: getColumnLabel(column),
      width: getColumnWidth(column),
      visibleColumnIndex,
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
  return (column as ConfigTableVirtualColumn).configColumn ?? visibleColumns.value[columnIndex]
}

function getConfigColumnIndex(column: TableV2Column<ConfigTableRow>, columnIndex: number): number {
  return (column as ConfigTableVirtualColumn).configColumnIndex ?? columnIndex
}

function getVisibleColumnIndex(column: TableV2Column<ConfigTableRow>, columnIndex: number): number {
  return (column as ConfigTableVirtualColumn).visibleColumnIndex ?? columnIndex
}

function getCellValue(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number): any {
  const value = getRawCellValue(row, column)
  const visibleColumnIndex = visibleColumns.value.indexOf(column)
  return column.formatter
    ? column.formatter({
        row,
        column,
        rowIndex,
        columnIndex,
        sourceColumnIndex: columnIndex,
        visibleColumnIndex,
        rawValue: value,
        value,
      })
    : value
}

function getRawCellValue(row: ConfigTableRow, column: ConfigTableColumn): any {
  return row[column.field]
}

function createHeaderParams(column: ConfigTableColumn, columnIndex: number, visibleColumnIndex: number) {
  return {
    allColumns: props.columns,
    column,
    columnIndex,
    columns: props.columns,
    data: tableData.value,
    index: columnIndex,
    sourceColumnIndex: columnIndex,
    visibleColumnIndex,
    visibleColumns: visibleColumns.value,
  }
}

function createSlotParams(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, visibleColumnIndex: number) {
  const rawValue = getRawCellValue(row, column)
  return {
    allColumns: props.columns,
    row,
    column,
    rowIndex,
    columnIndex,
    columns: props.columns,
    data: tableData.value,
    index: rowIndex,
    rawValue,
    sourceColumnIndex: columnIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
    visibleColumnIndex,
    visibleColumns: visibleColumns.value,
  }
}

function createCellParams(
  row: ConfigTableRow,
  column: ConfigTableColumn,
  rowIndex: number,
  columnIndex: number,
  visibleColumnIndex: number,
  event?: MouseEvent,
): ConfigTableCellParams {
  const rawValue = getRawCellValue(row, column)
  return {
    row,
    column,
    rowIndex,
    columnIndex,
    rawValue,
    sourceColumnIndex: columnIndex,
    value: getCellValue(row, column, rowIndex, columnIndex),
    visibleColumnIndex,
    event,
  }
}

function handleCellClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, visibleColumnIndex: number, event: MouseEvent): void {
  emit('cellClick', createCellParams(row, column, rowIndex, columnIndex, visibleColumnIndex, event))
}

function handleCellDblClick(row: ConfigTableRow, column: ConfigTableColumn, rowIndex: number, columnIndex: number, visibleColumnIndex: number, event: MouseEvent): void {
  emit('cellDblClick', createCellParams(row, column, rowIndex, columnIndex, visibleColumnIndex, event))
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
  handleCellClick(row, configColumn, rowIndex, configColumnIndex, getVisibleColumnIndex(column, columnIndex), event)
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
  handleCellDblClick(row, configColumn, rowIndex, configColumnIndex, getVisibleColumnIndex(column, columnIndex), event)
}

function warnOnce(key: string, message: string): void {
  if (!import.meta.env.DEV || !props.diagnostics || warnedDiagnostics.has(key))
    return

  warnedDiagnostics.add(key)
  console.warn(`[ConfigTable] ${message}`)
}

function createRendererHeaderScope(
  column: ConfigTableColumn,
  sourceColumnIndex: number,
  visibleColumnIndex: number,
): HeadlessTableHeaderScope<ConfigTableRow> {
  return {
    allColumns: orderedColumns.value as HeadlessTableColumn<ConfigTableRow>[],
    column: column as HeadlessTableColumn<ConfigTableRow>,
    columnIndex: sourceColumnIndex,
    columns: visibleColumns.value as HeadlessTableColumn<ConfigTableRow>[],
    data: tableData.value,
    index: sourceColumnIndex,
    sourceColumnIndex,
    visibleColumnIndex,
  } as HeadlessTableHeaderScope<ConfigTableRow>
}

function createRendererCellScope(
  row: ConfigTableRow,
  column: ConfigTableColumn,
  rowIndex: number,
  sourceColumnIndex: number,
  visibleColumnIndex: number,
): HeadlessTableCellScope<ConfigTableRow> {
  const rawValue = getRawCellValue(row, column)
  return {
    allColumns: orderedColumns.value as HeadlessTableColumn<ConfigTableRow>[],
    column: column as HeadlessTableColumn<ConfigTableRow>,
    columnIndex: sourceColumnIndex,
    columns: visibleColumns.value as HeadlessTableColumn<ConfigTableRow>[],
    data: tableData.value,
    index: rowIndex,
    rawValue,
    row,
    rowIndex,
    sourceColumnIndex,
    value: rawValue,
    visibleColumnIndex,
  } as HeadlessTableCellScope<ConfigTableRow>
}

function resolveRenderer(config: NonNullable<ConfigTableColumn['cellRender'] | ConfigTableColumn['headerRender']>) {
  return resolveHeadlessTableRenderer(
    config,
    props.renderers,
    props.rendererRegistry ?? injectedRendererRegistry ?? headlessTableRenderer,
  )
}

function renderVirtualHeader(params: { column: TableV2Column<ConfigTableRow>, columnIndex: number }): any {
  void slotsVersion.value
  const configColumn = getConfigColumn(params.column, params.columnIndex)
  const sourceColumnIndex = getConfigColumnIndex(params.column, params.columnIndex)
  const visibleColumnIndex = getVisibleColumnIndex(params.column, params.columnIndex)
  const slotScope = createHeaderParams(configColumn, sourceColumnIndex, visibleColumnIndex)
  const configuredSlot = configColumn.slots?.header

  if (typeof configuredSlot === 'function')
    return configuredSlot(slotScope)

  if (typeof configuredSlot === 'string') {
    const slotRender = slots[configuredSlot]
    if (slotRender)
      return slotRender(slotScope)
    warnOnce(`header-slot:${configuredSlot}`, `header slot "${configuredSlot}" was not found`)
  }

  if (configColumn.headerRender) {
    const { options, renderer } = resolveRenderer(configColumn.headerRender)
    if (renderer?.renderHeader) {
      return renderer.renderHeader(
        options,
        createRendererHeaderScope(configColumn, sourceColumnIndex, visibleColumnIndex),
      )
    }
    const reason = renderer ? 'does not implement renderHeader' : 'was not found'
    warnOnce(`header-renderer:${options.name}:${reason}`, `renderer "${options.name}" ${reason}`)
  }

  return getColumnLabel(configColumn)
}

function renderVirtualCell(params: {
  rowData: ConfigTableRow
  rowIndex: number
  column: TableV2Column<ConfigTableRow>
  columnIndex: number
}): any {
  void slotsVersion.value
  const row = getRawRow(params.rowData, params.rowIndex)
  const configColumn = getConfigColumn(params.column, params.columnIndex)
  const sourceColumnIndex = getConfigColumnIndex(params.column, params.columnIndex)
  const visibleColumnIndex = getVisibleColumnIndex(params.column, params.columnIndex)
  const configuredSlot = configColumn.slots?.default

  if (typeof configuredSlot === 'function') {
    return configuredSlot(createSlotParams(
      row,
      configColumn,
      params.rowIndex,
      sourceColumnIndex,
      visibleColumnIndex,
    ))
  }

  if (typeof configuredSlot === 'string') {
    const slotRender = slots[configuredSlot]
    if (slotRender) {
      return slotRender(createSlotParams(
        row,
        configColumn,
        params.rowIndex,
        sourceColumnIndex,
        visibleColumnIndex,
      ))
    }
    warnOnce(`cell-slot:${configuredSlot}`, `cell slot "${configuredSlot}" was not found`)
  }

  if (configColumn.cellRender) {
    const { options, renderer } = resolveRenderer(configColumn.cellRender)
    if (renderer?.renderDefault) {
      return renderer.renderDefault(
        options,
        createRendererCellScope(row, configColumn, params.rowIndex, sourceColumnIndex, visibleColumnIndex),
      )
    }
    const reason = renderer ? 'does not implement renderDefault' : 'was not found'
    warnOnce(`cell-renderer:${options.name}:${reason}`, `renderer "${options.name}" ${reason}`)
  }

  return getCellValue(row, configColumn, params.rowIndex, sourceColumnIndex)
}

function applyColumnSettings(value: ConfigTableColumnSettingChange): void {
  columnOrderState.value = [...value.columnOrder]
  columnVisibilityState.value = { ...value.columnVisibility }
  emit('update:columnOrder', [...value.columnOrder])
  emit('update:columnVisibility', { ...value.columnVisibility })
  emit('columnSettingChange', {
    columnOrder: [...value.columnOrder],
    columnVisibility: { ...value.columnVisibility },
  })
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
  <div class="mx-config-table-shell">
    <ConfigTableColumnSettings
      v-if="columnConfigEnabled"
      class="mx-config-table__toolbar"
      :columns="props.columns"
      :column-order="columnOrderState"
      :column-visibility="columnVisibilityState"
      :config="normalizedColumnConfig"
      @apply="applyColumnSettings"
    />
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
          :render="renderVirtualHeader"
          :params="{ column, columnIndex }"
        />
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
            :render="renderVirtualCell"
            :params="{ rowData, rowIndex, column, columnIndex }"
          />
        </div>
      </template>
      <template #empty>
        <ConfigTableRenderNode
          v-if="props.slots?.empty"
          :render="props.slots.empty"
          :params="{ columns: props.columns, data: tableData }"
        />
        <slot
          v-else
          name="empty"
          :columns="props.columns"
          :data="tableData"
        >
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
  </div>
</template>

<style scoped>
.mx-config-table {
  width: 100%;
}

.mx-config-table-shell {
  width: 100%;
  min-width: 0;
}

.mx-config-table__toolbar {
  margin-bottom: 10px;
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
