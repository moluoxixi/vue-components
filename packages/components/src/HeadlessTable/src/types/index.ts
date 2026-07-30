import type { Component, VNodeChild } from 'vue'

export type HeadlessTableRow = Record<string, any>

export interface HeadlessTableRendererOptions {
  name: string
  props?: Record<string, any>
  options?: any
  [key: string]: any
}

export type HeadlessTableRendererConfig = string | HeadlessTableRendererOptions

export interface HeadlessTableColumn<TRow extends HeadlessTableRow = HeadlessTableRow> {
  /** Row field. Dot paths such as `user.name` are supported. */
  field: string
  title?: string
  label?: string
  visible?: boolean
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** Named Vue slots or inline render functions. */
  slots?: {
    default?: string | HeadlessTableCellRender<TRow>
    header?: string | HeadlessTableHeaderRender<TRow>
  }
  /** Renderer registry entries, following the vxe-table render-option pattern. */
  cellRender?: HeadlessTableRendererConfig
  headerRender?: HeadlessTableRendererConfig
  formatter?: (params: HeadlessTableCellScope<TRow>) => any
  /** Adapter-specific column options, for example Element Plus ElTableColumn props. */
  columnProps?: Record<string, any>
}

export interface HeadlessTableBaseScope<TRow extends HeadlessTableRow = HeadlessTableRow> {
  columns: HeadlessTableColumn<TRow>[]
  data: TRow[]
}

export interface HeadlessTableHeaderScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {
  column: HeadlessTableColumn<TRow>
  columnIndex: number
  index: number
}

export interface HeadlessTableCellScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {
  row: TRow
  column: HeadlessTableColumn<TRow>
  rowIndex: number
  columnIndex: number
  index: number
  value: any
}

export interface HeadlessTableEmptyScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {}

export type HeadlessTableHeaderRender<TRow extends HeadlessTableRow = HeadlessTableRow>
  = (params: HeadlessTableHeaderScope<TRow>) => VNodeChild

export type HeadlessTableCellRender<TRow extends HeadlessTableRow = HeadlessTableRow>
  = (params: HeadlessTableCellScope<TRow>) => VNodeChild

export type HeadlessTableEmptyRender<TRow extends HeadlessTableRow = HeadlessTableRow>
  = (params: HeadlessTableEmptyScope<TRow>) => VNodeChild

export interface HeadlessTableRendererDefinition<TRow extends HeadlessTableRow = HeadlessTableRow> {
  renderDefault?: (
    renderOptions: HeadlessTableRendererOptions,
    params: HeadlessTableCellScope<TRow>,
  ) => VNodeChild
  renderHeader?: (
    renderOptions: HeadlessTableRendererOptions,
    params: HeadlessTableHeaderScope<TRow>,
  ) => VNodeChild
}

export type HeadlessTableRendererMap<TRow extends HeadlessTableRow = HeadlessTableRow>
  = Record<string, HeadlessTableRendererDefinition<TRow>>

export interface HeadlessTableRendererRegistry {
  add: <TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ) => this
  mixin: (renderers: HeadlessTableRendererMap<any>) => this
  get: (name: string) => HeadlessTableRendererDefinition<any> | undefined
  delete: (name: string) => boolean
}

export interface HeadlessTableProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  columns?: HeadlessTableColumn<TRow>[]
  data?: TRow[]
  emptyText?: string
  /** Per-table renderers override entries from the global registry. */
  renderers?: HeadlessTableRendererMap<TRow>
  /** Table-level render-function configuration. */
  slots?: {
    empty?: HeadlessTableEmptyRender<TRow>
  }
}

export interface HeadlessTableDefaultScope<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableBaseScope<TRow> {
  allColumns: HeadlessTableColumn<TRow>[]
  Cell: HeadlessTableCellComponent<TRow>
  Header: HeadlessTableHeaderComponent<TRow>
  Empty: HeadlessTableEmptyComponent
  getCellValue: (
    row: TRow,
    column: HeadlessTableColumn<TRow>,
    rowIndex: number,
    columnIndex: number,
  ) => any
  getColumnLabel: (column: HeadlessTableColumn<TRow>) => string
}

export interface HeadlessTableCellComponentProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  row: TRow
  column: HeadlessTableColumn<TRow>
  rowIndex: number
  columnIndex?: number
}

export interface HeadlessTableHeaderComponentProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  column: HeadlessTableColumn<TRow>
  columnIndex?: number
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
