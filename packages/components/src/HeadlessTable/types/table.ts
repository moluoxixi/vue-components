import type { VNodeChild } from 'vue'
import type { HeadlessTableCellModeActions, HeadlessTableMode } from './mode'

export type HeadlessTableRow = Record<string, any>
export type HeadlessTableRowKey = string | number

export interface HeadlessTableRendererOptions<
  TProps extends Record<string, any> = Record<string, any>,
  TOptions = any,
> {
  name: string
  props?: TProps
  options?: TOptions
}

export type HeadlessTableRendererConfig = string | HeadlessTableRendererOptions

interface HeadlessTableColumnBase<
  TRow extends HeadlessTableRow,
  TValue,
  TColumnProps extends Record<string, any>,
> {
  /** Stable column identity. Required for computed and display-only columns. */
  id?: string
  /** Compatibility alias that can act as both the column id and accessor key. */
  field?: string
  /** Row field accessor. Dot paths such as `user.name` are supported. */
  accessorKey?: string
  /** Function accessor for computed values. */
  accessor?: (row: TRow) => TValue
  title?: string
  label?: string
  visible?: boolean
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** Named Vue slots or inline render functions. */
  slots?: {
    default?: string | HeadlessTableCellRender<TRow, TValue>
    edit?: string | HeadlessTableCellRender<TRow, TValue>
    header?: string | HeadlessTableHeaderRender<TRow>
  }
  /** Renderer registry entries, following the vxe-table render-option pattern. */
  cellRender?: HeadlessTableRendererConfig
  headerRender?: HeadlessTableRendererConfig
  formatter?: (params: HeadlessTableCellScope<TRow, TValue>) => any
  /** Client-side sorting comparator used by useHeadlessTable. */
  sorter?: (left: TRow, right: TRow) => number
  /** Client-side filter predicate used by useHeadlessTable. */
  filter?: (value: TValue, filterValue: unknown, row: TRow) => boolean
  /** Adapter-specific column options, for example Element Plus ElTableColumn props. */
  columnProps?: TColumnProps
}

type HeadlessTableColumnIdentity
  = | { id: string, field?: string, accessorKey?: string }
    | { id?: string, field: string, accessorKey?: string }
    | { id?: string, field?: string, accessorKey: string }

export type HeadlessTableColumn<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TValue = any,
  TColumnProps extends Record<string, any> = Record<string, any>,
> = HeadlessTableColumnBase<TRow, TValue, TColumnProps> & HeadlessTableColumnIdentity

export interface HeadlessTableBaseScope<TRow extends HeadlessTableRow = HeadlessTableRow> {
  allColumns: HeadlessTableColumn<TRow>[]
  columns: HeadlessTableColumn<TRow>[]
  data: TRow[]
  /** Effective table-wide mode. Cell scopes override this with their effective cell mode. */
  mode: HeadlessTableMode
}

export interface HeadlessTableHeaderScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {
  column: HeadlessTableColumn<TRow>
  columnIndex: number
  /** @deprecated Use columnIndex instead. */
  index: number
}

export interface HeadlessTableCellScope<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TValue = any,
> extends HeadlessTableBaseScope<TRow> {
  row: TRow
  column: HeadlessTableColumn<TRow, TValue>
  rowIndex: number
  rowId?: HeadlessTableRowKey
  columnIndex: number
  /** @deprecated Use rowIndex instead. */
  index: number
  /** Raw accessor value. Formatter output is only used as the fallback display value. */
  value: TValue
  rawValue: TValue
  setRowMode: HeadlessTableCellModeActions['setRowMode']
  clearRowMode: HeadlessTableCellModeActions['clearRowMode']
  setCellMode: HeadlessTableCellModeActions['setCellMode']
  clearCellMode: HeadlessTableCellModeActions['clearCellMode']
}

export interface HeadlessTableEmptyScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {}

export type HeadlessTableHeaderRender<TRow extends HeadlessTableRow = HeadlessTableRow>
  = (params: HeadlessTableHeaderScope<TRow>) => VNodeChild

export type HeadlessTableCellRender<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TValue = any,
> = (params: HeadlessTableCellScope<TRow, TValue>) => VNodeChild

export type HeadlessTableEmptyRender<TRow extends HeadlessTableRow = HeadlessTableRow>
  = (params: HeadlessTableEmptyScope<TRow>) => VNodeChild
