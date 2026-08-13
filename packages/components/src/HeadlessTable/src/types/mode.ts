import type { ComputedRef } from 'vue'
import type { HeadlessTableRowKey } from './table'

export type HeadlessTableMode = 'default' | 'edit'

export interface HeadlessTableRowModeSelectorScope<TRow = Record<string, any>> {
  row: TRow
  rowIndex: number
  rowId: HeadlessTableRowKey
}

export interface HeadlessTableCellModeSelectorScope<
  TRow = Record<string, any>,
  TColumn = unknown,
> extends HeadlessTableRowModeSelectorScope<TRow> {
  column: TColumn
  columnIndex: number
  columnId: string
}

export type HeadlessTableRowModeSelector<TRow = Record<string, any>>
  = (scope: HeadlessTableRowModeSelectorScope<TRow>) => boolean

export type HeadlessTableCellModeSelector<
  TRow = Record<string, any>,
  TColumn = unknown,
> = (scope: HeadlessTableCellModeSelectorScope<TRow, TColumn>) => boolean

export type HeadlessTableModeChange
  = | {
    scope: 'table'
    action: 'set' | 'clear'
    mode: HeadlessTableMode
    previousMode: HeadlessTableMode
  }
  | {
    scope: 'row'
    action: 'set' | 'clear'
    rowId: HeadlessTableRowKey
    mode: HeadlessTableMode
    previousMode: HeadlessTableMode
  }
  | {
    scope: 'cell'
    action: 'set' | 'clear'
    rowId: HeadlessTableRowKey
    columnId: string
    mode: HeadlessTableMode
    previousMode: HeadlessTableMode
  }
  | {
    scope: 'row' | 'cell' | 'all'
    action: 'clearAll'
    cleared: number
    mode: HeadlessTableMode
  }

export interface HeadlessTableModeApi<
  TRow = Record<string, any>,
  TColumn = unknown,
> {
  /** Effective table-wide mode after resolving the API override and mode prop. */
  mode: ComputedRef<HeadlessTableMode>
  setMode: (mode: HeadlessTableMode) => void
  clearMode: () => void
  setRowMode: {
    (rowId: HeadlessTableRowKey, mode: HeadlessTableMode): void
    (selector: HeadlessTableRowModeSelector<TRow>, mode: HeadlessTableMode): void
  }
  clearRowMode: (rowId: HeadlessTableRowKey) => void
  setCellMode: {
    (rowId: HeadlessTableRowKey, columnId: string, mode: HeadlessTableMode): void
    (selector: HeadlessTableCellModeSelector<TRow, TColumn>, mode: HeadlessTableMode): void
  }
  clearCellMode: (rowId: HeadlessTableRowKey, columnId: string) => void
  clearAllRowModes: () => void
  clearAllCellModes: () => void
  clearAllModes: () => void
  getRowMode: (rowId: HeadlessTableRowKey) => HeadlessTableMode
  getCellMode: (rowId: HeadlessTableRowKey, columnId: string) => HeadlessTableMode
}

export interface HeadlessTableCellModeActions {
  setRowMode: (mode: HeadlessTableMode) => void
  clearRowMode: () => void
  setCellMode: (mode: HeadlessTableMode) => void
  clearCellMode: () => void
}
