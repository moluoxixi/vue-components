import type { Column as TableV2Column } from 'element-plus'
import type { ComputedRef } from 'vue'
import type {
  HeadlessTableCellScope,
  HeadlessTableColumn,
  HeadlessTableHeaderScope,
  HeadlessTableModeApi,
  HeadlessTableRowKey,
} from '#components/HeadlessTable'
import type {
  ConfigTableCellParams,
  ConfigTableColumn,
  ConfigTableEmits,
  ConfigTableProps,
  ConfigTableRow,
  ConfigTableSlots,
} from '../types'
import { inject, onBeforeUpdate, shallowRef } from 'vue'
import {
  headlessTableRenderer,
  headlessTableRendererKey,
  resolveHeadlessTableRenderer,
} from '#components/HeadlessTable'
import { getConfigTableColumnLabel } from './use-config-table-columns'

interface UseConfigTableRendererOptions {
  props: Readonly<ConfigTableProps>
  emit: ConfigTableEmits
  slots: ConfigTableSlots
  tableData: ComputedRef<ConfigTableRow[]>
  orderedColumns: ComputedRef<ConfigTableColumn[]>
  visibleColumns: ComputedRef<ConfigTableColumn[]>
  getRawRow: (rowData: ConfigTableRow, rowIndex: number) => ConfigTableRow
  getConfigColumn: (
    column: TableV2Column<ConfigTableRow>,
    columnIndex: number,
  ) => ConfigTableColumn
  getConfigColumnIndex: (
    column: TableV2Column<ConfigTableRow>,
    columnIndex: number,
  ) => number
  getVisibleColumnIndex: (
    column: TableV2Column<ConfigTableRow>,
    columnIndex: number,
  ) => number
  getRowId: (row: ConfigTableRow, rowIndex: number) => HeadlessTableRowKey | undefined
  modeApi: HeadlessTableModeApi
}

export function useConfigTableRenderer(options: UseConfigTableRendererOptions) {
  const {
    emit,
    getConfigColumn,
    getConfigColumnIndex,
    getRawRow,
    getVisibleColumnIndex,
    orderedColumns,
    props,
    slots,
    tableData,
    visibleColumns,
    getRowId,
    modeApi,
  } = options
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

  function getRawCellValue(row: ConfigTableRow, column: ConfigTableColumn): any {
    return row[column.field]
  }

  function getCellValue(
    row: ConfigTableRow,
    column: ConfigTableColumn,
    rowIndex: number,
    columnIndex: number,
  ): any {
    const value = getRawCellValue(row, column)
    const visibleColumnIndex = visibleColumns.value.indexOf(column)
    const rowId = getRowId(row, rowIndex)
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
          mode: rowId == null ? modeApi.mode.value : modeApi.getCellMode(rowId, column.id ?? column.field),
        })
      : value
  }

  function createHeaderParams(
    column: ConfigTableColumn,
    columnIndex: number,
    visibleColumnIndex: number,
  ) {
    const columns = props.columns ?? []
    return {
      allColumns: columns,
      column,
      columnIndex,
      columns,
      data: tableData.value,
      index: columnIndex,
      mode: modeApi.mode.value,
      sourceColumnIndex: columnIndex,
      visibleColumnIndex,
      visibleColumns: visibleColumns.value,
    }
  }

  function createSlotParams(
    row: ConfigTableRow,
    column: ConfigTableColumn,
    rowIndex: number,
    columnIndex: number,
    visibleColumnIndex: number,
  ) {
    const columns = props.columns ?? []
    const rawValue = getRawCellValue(row, column)
    const rowId = getRowId(row, rowIndex)
    const columnId = column.id ?? column.field
    const mode = rowId == null ? modeApi.mode.value : modeApi.getCellMode(rowId, columnId)
    const requireRowId = (): HeadlessTableRowKey => {
      if (rowId == null)
        throw new Error('[ConfigTable] getRowId or a stable rowKey is required for row/cell mode APIs')
      return rowId
    }
    return {
      allColumns: columns,
      row,
      column,
      rowIndex,
      columnIndex,
      columns,
      data: tableData.value,
      index: rowIndex,
      mode,
      rawValue,
      rowId,
      clearCellMode: () => modeApi.clearCellMode(requireRowId(), columnId),
      clearRowMode: () => modeApi.clearRowMode(requireRowId()),
      setCellMode: (nextMode: any) => modeApi.setCellMode(requireRowId(), columnId, nextMode),
      setRowMode: (nextMode: any) => modeApi.setRowMode(requireRowId(), nextMode),
      sourceColumnIndex: columnIndex,
      value: rawValue,
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
    const rowId = getRowId(row, rowIndex)
    return {
      row,
      column,
      rowIndex,
      columnIndex,
      rawValue,
      mode: rowId == null ? modeApi.mode.value : modeApi.getCellMode(rowId, column.id ?? column.field),
      sourceColumnIndex: columnIndex,
      value: getCellValue(row, column, rowIndex, columnIndex),
      visibleColumnIndex,
      event,
    }
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
    emit('cellClick', createCellParams(
      row,
      configColumn,
      rowIndex,
      configColumnIndex,
      getVisibleColumnIndex(column, columnIndex),
      event,
    ))
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
    emit('cellDblClick', createCellParams(
      row,
      configColumn,
      rowIndex,
      configColumnIndex,
      getVisibleColumnIndex(column, columnIndex),
      event,
    ))
  }

  function warnOnce(key: string, message: string): void {
    if (!import.meta.env.DEV || props.diagnostics === false || warnedDiagnostics.has(key))
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
      mode: modeApi.mode.value,
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
    const rowId = getRowId(row, rowIndex)
    const columnId = column.id ?? column.field
    const requireRowId = (): HeadlessTableRowKey => {
      if (rowId == null)
        throw new Error('[ConfigTable] getRowId or a stable rowKey is required for row/cell mode APIs')
      return rowId
    }
    return {
      allColumns: orderedColumns.value as HeadlessTableColumn<ConfigTableRow>[],
      column: column as HeadlessTableColumn<ConfigTableRow>,
      columnIndex: sourceColumnIndex,
      columns: visibleColumns.value as HeadlessTableColumn<ConfigTableRow>[],
      data: tableData.value,
      index: rowIndex,
      mode: rowId == null ? modeApi.mode.value : modeApi.getCellMode(rowId, columnId),
      rawValue,
      row,
      rowIndex,
      rowId,
      clearCellMode: () => modeApi.clearCellMode(requireRowId(), columnId),
      clearRowMode: () => modeApi.clearRowMode(requireRowId()),
      setCellMode: (nextMode: any) => modeApi.setCellMode(requireRowId(), columnId, nextMode),
      setRowMode: (nextMode: any) => modeApi.setRowMode(requireRowId(), nextMode),
      sourceColumnIndex,
      value: rawValue,
      visibleColumnIndex,
    } as HeadlessTableCellScope<ConfigTableRow>
  }

  function resolveRenderer(
    config: NonNullable<ConfigTableColumn['cellRender'] | ConfigTableColumn['headerRender']>,
  ) {
    return resolveHeadlessTableRenderer(
      config,
      props.renderers ?? {},
      props.rendererRegistry ?? injectedRendererRegistry ?? headlessTableRenderer,
    )
  }

  function renderVirtualHeader(params: {
    column: TableV2Column<ConfigTableRow>
    columnIndex: number
  }): any {
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
      const { options: rendererOptions, renderer } = resolveRenderer(configColumn.headerRender)
      if (renderer?.renderHeader) {
        return renderer.renderHeader(
          rendererOptions,
          createRendererHeaderScope(configColumn, sourceColumnIndex, visibleColumnIndex),
        )
      }
      const reason = renderer ? 'does not implement renderHeader' : 'was not found'
      warnOnce(
        `header-renderer:${rendererOptions.name}:${reason}`,
        `renderer "${rendererOptions.name}" ${reason}`,
      )
    }

    return getConfigTableColumnLabel(configColumn)
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
    const configuredEditSlot = configColumn.slots?.edit

    if (configuredEditSlot) {
      const slotScope = createSlotParams(
        row,
        configColumn,
        params.rowIndex,
        sourceColumnIndex,
        visibleColumnIndex,
      )
      if (slotScope.mode === 'edit') {
        if (typeof configuredEditSlot === 'function')
          return configuredEditSlot(slotScope)

        if (typeof configuredEditSlot === 'string') {
          const editSlotRender = slots[configuredEditSlot]
          if (editSlotRender)
            return editSlotRender(slotScope)
          warnOnce(`edit-cell-slot:${configuredEditSlot}`, `edit cell slot "${configuredEditSlot}" was not found`)
        }
      }
    }

    const slotScope = configuredSlot
      ? createSlotParams(
          row,
          configColumn,
          params.rowIndex,
          sourceColumnIndex,
          visibleColumnIndex,
        )
      : undefined

    if (typeof configuredSlot === 'function') {
      return configuredSlot(slotScope!)
    }

    if (typeof configuredSlot === 'string') {
      const slotRender = slots[configuredSlot]
      if (slotRender) {
        return slotRender(slotScope!)
      }
      warnOnce(`cell-slot:${configuredSlot}`, `cell slot "${configuredSlot}" was not found`)
    }

    if (configColumn.cellRender) {
      const { options: rendererOptions, renderer } = resolveRenderer(configColumn.cellRender)
      if (renderer?.renderDefault) {
        return renderer.renderDefault(
          rendererOptions,
          createRendererCellScope(
            row,
            configColumn,
            params.rowIndex,
            sourceColumnIndex,
            visibleColumnIndex,
          ),
        )
      }
      const reason = renderer ? 'does not implement renderDefault' : 'was not found'
      warnOnce(
        `cell-renderer:${rendererOptions.name}:${reason}`,
        `renderer "${rendererOptions.name}" ${reason}`,
      )
    }

    return getCellValue(row, configColumn, params.rowIndex, sourceColumnIndex)
  }

  return {
    handleVirtualCellClick,
    handleVirtualCellDblClick,
    renderVirtualCell,
    renderVirtualHeader,
  }
}
