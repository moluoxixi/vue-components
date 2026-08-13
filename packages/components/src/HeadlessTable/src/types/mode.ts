import type { ComputedRef } from 'vue'
import type { HeadlessTableRowKey } from './table'

export type HeadlessTableMode = 'default' | 'edit'

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
  getRowMode: (rowId: HeadlessTableRowKey) => HeadlessTableMode
  getCellMode: (rowId: HeadlessTableRowKey, columnId: string) => HeadlessTableMode
}

export interface HeadlessTableCellModeActions {
  setRowMode: (mode: HeadlessTableMode) => void
  clearRowMode: () => void
  setCellMode: (mode: HeadlessTableMode) => void
  clearCellMode: () => void
}
