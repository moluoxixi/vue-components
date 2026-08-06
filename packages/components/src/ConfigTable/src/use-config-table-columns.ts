import type { Column as TableV2Column } from 'element-plus'
import type { ComputedRef } from 'vue'
import type { HeadlessTableColumn } from '../../HeadlessTable/src/types'
import type {
  ConfigTableColumn,
  ConfigTableColumnConfig,
  ConfigTableColumnSettingChange,
  ConfigTableColumnWidthState,
  ConfigTableEmits,
  ConfigTableProps,
  ConfigTableRow,
  ConfigTableRowClass,
  ConfigTableRowClassParams,
} from './types'
import { computed, ref, watch } from 'vue'
import { projectHeadlessTableColumns } from '../../HeadlessTable/src/core'
import {
  getConfigTableColumnMinWidth,
  getConfigTableColumnWidth,
} from './column-width'

export interface ConfigTableVirtualColumn extends TableV2Column<ConfigTableRow> {
  configColumn: ConfigTableColumn
  columnId: string
  configColumnIndex: number
  visibleColumnIndex: number
}

export function getConfigTableColumnLabel(column: ConfigTableColumn): string {
  return column.label ?? column.title ?? column.field
}

export function useConfigTableColumns(
  props: Readonly<ConfigTableProps>,
  tableData: ComputedRef<ConfigTableRow[]>,
  emit: ConfigTableEmits,
) {
  const columnOrderState = ref<string[]>([...(props.columnOrder ?? [])])
  const columnVisibilityState = ref<Record<string, boolean>>({ ...(props.columnVisibility ?? {}) })
  const columnWidthsState = ref<ConfigTableColumnWidthState>({ ...(props.columnWidths ?? {}) })

  const normalizedColumnConfig = computed<ConfigTableColumnConfig>(() => ({
    buttonText: '列设置',
    draggable: true,
    title: '列设置',
    width: 440,
    minColumnWidth: props.minColumnWidth,
    maxColumnWidth: props.maxColumnWidth,
    columnWidthStep: props.columnWidthStep ?? 10,
    ...(typeof props.columnConfig === 'object' ? props.columnConfig : {}),
  }))

  const columnConfigEnabled = computed(() => props.columnConfig !== false)

  watch(() => props.columnOrder, (value) => {
    columnOrderState.value = [...(value ?? [])]
  }, { deep: true })

  watch(() => props.columnVisibility, (value) => {
    columnVisibilityState.value = { ...(value ?? {}) }
  }, { deep: true })

  watch(() => props.columnWidths, (value) => {
    columnWidthsState.value = { ...(value ?? {}) }
  }, { deep: true })

  const columnProjection = computed(() => projectHeadlessTableColumns(
    (props.columns ?? []) as HeadlessTableColumn<ConfigTableRow>[],
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
    return columnProjection.value.columns.map(({ column: projectedColumn, columnId, sourceIndex }, visibleColumnIndex) => {
      const column = projectedColumn as ConfigTableColumn
      const columnProps = column.columnProps ?? {}

      return {
        ...columnProps,
        align: column.align ?? columnProps.align,
        class: columnProps.class ?? columnProps.className,
        configColumn: column,
        configColumnIndex: sourceIndex,
        columnId,
        dataKey: columnProps.dataKey ?? column.field,
        key: columnProps.key ?? column.field,
        minWidth: getConfigTableColumnMinWidth(column),
        title: getConfigTableColumnLabel(column),
        width: getConfigTableColumnWidth(
          column,
          sourceIndex,
          columnWidthsState.value,
          {
            defaultColumnWidth: props.defaultColumnWidth ?? 160,
            minColumnWidth: props.minColumnWidth,
            maxColumnWidth: props.maxColumnWidth,
          },
        ),
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
    } = (props.tableProps ?? {}) as Record<string, any>

    return {
      ...rest,
      rowClass: resolveRowClass,
    }
  })

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

  function applyColumnSettings(value: ConfigTableColumnSettingChange): void {
    columnOrderState.value = [...value.columnOrder]
    columnVisibilityState.value = { ...value.columnVisibility }
    columnWidthsState.value = { ...value.columnWidths }
    emit('update:columnOrder', [...value.columnOrder])
    emit('update:columnVisibility', { ...value.columnVisibility })
    emit('update:columnWidths', { ...value.columnWidths })
    emit('columnSettingChange', {
      columnOrder: [...value.columnOrder],
      columnVisibility: { ...value.columnVisibility },
      columnWidths: { ...value.columnWidths },
    })
  }

  function resolveRowClass(params: {
    columns: TableV2Column<ConfigTableRow>[]
    rowData: ConfigTableRow
    rowIndex: number
  }): string {
    const tableProps = (props.tableProps ?? {}) as {
      rowClass?: ConfigTableRowClass
      rowClassName?: ConfigTableRowClass
    }
    const rowClass = tableProps.rowClass ?? tableProps.rowClassName
    const rowClassParams: ConfigTableRowClassParams = {
      columns: props.columns ?? [],
      rowData: getRawRow(params.rowData, params.rowIndex),
      rowIndex: params.rowIndex,
    }
    const customClass = typeof rowClass === 'function'
      ? rowClass(rowClassParams)
      : rowClass
    const currentClass = params.rowIndex === (props.currentRowIndex ?? -1)
      ? 'mx-config-table__row--current'
      : ''

    return [customClass, currentClass].filter(Boolean).join(' ')
  }

  return {
    applyColumnSettings,
    columnConfigEnabled,
    columnOrderState,
    columnVisibilityState,
    columnWidthsState,
    getConfigColumn,
    getConfigColumnIndex,
    getRawRow,
    getVisibleColumnIndex,
    normalizedColumnConfig,
    orderedColumns,
    virtualColumns,
    virtualTableProps,
    visibleColumns,
  }
}
