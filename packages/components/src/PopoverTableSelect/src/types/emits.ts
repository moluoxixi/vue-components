import type { PopoverTableColumn, PopoverTableRow } from './props'

export interface PopoverTableCellParams {
  row: PopoverTableRow
  column: PopoverTableColumn
  rowIndex: number
  columnIndex: number
  event: MouseEvent
}

/**
 * PopoverTableSelect 外层组件事件。
 */
export interface PopoverTableSelectEmits {
  (event: 'focus'): void
  (event: 'blur'): void
  (event: 'enter', row: PopoverTableRow): void
  (event: 'clear'): void
  (event: 'loadMore'): void
  (event: 'select', row: PopoverTableRow): void
  (event: 'input', value: string): void
}

/**
 * PopoverTableSelectBase 表格事件。
 */
export interface PopoverTableSelectBaseEmits {
  (event: 'select', row: PopoverTableRow): void
  (event: 'cellClick', params: PopoverTableCellParams): void
  (event: 'cellDblClick', params: PopoverTableCellParams): void
  (event: 'scrollBoundary', payload: { direction: 'bottom' }): void
  (event: 'enter', row: PopoverTableRow): void
}
