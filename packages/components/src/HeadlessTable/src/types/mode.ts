import type { ComputedRef } from 'vue'
import type { HeadlessTableRowKey } from './table'

export type HeadlessTableMode = 'default' | 'edit'

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

export interface HeadlessTableModeApi {
  /** Effective table-wide mode after resolving the API override and mode prop. */
  mode: ComputedRef<HeadlessTableMode>
  setMode: (mode: HeadlessTableMode) => void
  clearMode: () => void
  setRowMode: (rowId: HeadlessTableRowKey, mode: HeadlessTableMode) => void
  clearRowMode: (rowId: HeadlessTableRowKey) => void
  setCellMode: (
    rowId: HeadlessTableRowKey,
    columnId: string,
    mode: HeadlessTableMode,
  ) => void
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
