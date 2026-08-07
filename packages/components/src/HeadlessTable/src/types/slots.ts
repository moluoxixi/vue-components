import type { Component } from 'vue'
import type {
  HeadlessTableBaseScope,
  HeadlessTableColumn,
  HeadlessTableEmptyScope,
  HeadlessTableRow,
} from './table'

export interface HeadlessTableDefaultScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {
  Cell: HeadlessTableCellComponent<TRow>
  Header: HeadlessTableHeaderComponent<TRow>
  Empty: HeadlessTableEmptyComponent
  getCellValue: (
    row: TRow,
    column: HeadlessTableColumn<TRow>,
    rowIndex: number,
    columnIndex: number,
  ) => any
  getRawCellValue: (
    row: TRow,
    column: HeadlessTableColumn<TRow>,
    rowIndex: number,
  ) => any
  getColumnId: (column: HeadlessTableColumn<TRow>, columnIndex?: number) => string
  getColumnLabel: (column: HeadlessTableColumn<TRow>, columnIndex?: number) => string
}

export interface HeadlessTableCellComponentProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  row: TRow
  column: HeadlessTableColumn<TRow>
  rowIndex: number
  columnIndex: number
}

export interface HeadlessTableHeaderComponentProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  column: HeadlessTableColumn<TRow>
  columnIndex: number
}

export type HeadlessTableCellComponent<TRow extends HeadlessTableRow = HeadlessTableRow>
  = Component<HeadlessTableCellComponentProps<TRow>>

export type HeadlessTableHeaderComponent<TRow extends HeadlessTableRow = HeadlessTableRow>
  = Component<HeadlessTableHeaderComponentProps<TRow>>

export type HeadlessTableEmptyComponent = Component<Record<string, never>>

export type HeadlessTableSlots<TRow extends HeadlessTableRow = HeadlessTableRow> = {
  default?: (scope: HeadlessTableDefaultScope<TRow>) => any
  empty?: (scope: HeadlessTableEmptyScope<TRow>) => any
} & Record<string, ((scope: any) => any) | undefined>
