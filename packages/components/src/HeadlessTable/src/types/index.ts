import type {
  App,
  Component,
  ComputedRef,
  MaybeRefOrGetter,
  Ref,
  VNodeChild,
} from 'vue'

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
  columnIndex: number
  /** @deprecated Use rowIndex instead. */
  index: number
  /** Raw accessor value. Formatter output is only used as the fallback display value. */
  value: TValue
  rawValue: TValue
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

export interface HeadlessTableRendererDefinition<
  TRow extends HeadlessTableRow = HeadlessTableRow,
  TProps extends Record<string, any> = Record<string, any>,
  TOptions = any,
> {
  renderDefault?: (
    renderOptions: HeadlessTableRendererOptions<TProps, TOptions>,
    params: HeadlessTableCellScope<TRow>,
  ) => VNodeChild
  renderHeader?: (
    renderOptions: HeadlessTableRendererOptions<TProps, TOptions>,
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
  replace: <TRow extends HeadlessTableRow = HeadlessTableRow>(
    name: string,
    renderer: HeadlessTableRendererDefinition<TRow>,
  ) => this
  mixin: (renderers: HeadlessTableRendererMap<any>, options?: { replace?: boolean }) => this
  get: (name: string) => HeadlessTableRendererDefinition<any> | undefined
  has: (name: string) => boolean
  delete: (name: string) => boolean
  clear: () => void
}

export interface HeadlessTableRendererPluginOptions {
  /** Reuse an existing registry when several apps or adapters share one. */
  registry?: HeadlessTableRendererRegistry
  /** Register these renderers during plugin installation. */
  renderers?: HeadlessTableRendererMap<any>
  /** Replace existing names instead of throwing on duplicate registration. */
  replace?: boolean
}

export interface HeadlessTableRendererPlugin {
  registry: HeadlessTableRendererRegistry
  install: (app: App) => void
}

export interface HeadlessTableProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  columns?: HeadlessTableColumn<TRow>[]
  data?: TRow[]
  emptyText?: string
  /** Emit development warnings for invalid renderer and slot configuration. */
  diagnostics?: boolean
  /** Per-table renderers override entries from the scoped or global registry. */
  renderers?: HeadlessTableRendererMap<TRow>
  /** Registry for this table. It overrides the injected and global registries. */
  rendererRegistry?: HeadlessTableRendererRegistry
  /** Table-level render-function configuration. */
  slots?: {
    empty?: HeadlessTableEmptyRender<TRow>
  }
}

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

export type HeadlessTableSortDirection = 'asc' | 'desc'

export interface HeadlessTableSortingRule {
  id: string
  direction: HeadlessTableSortDirection
}

export type HeadlessTableSortingState = HeadlessTableSortingRule[]
export type HeadlessTableFiltersState = Record<string, unknown>
export type HeadlessTableColumnVisibilityState = Record<string, boolean>
export type HeadlessTableColumnOrderState = string[]

export interface HeadlessTablePaginationState {
  currentPage: number
  pageSize: number
}

export interface HeadlessTableControlledState {
  sorting: Ref<HeadlessTableSortingState>
  filters: Ref<HeadlessTableFiltersState>
  pagination: Ref<HeadlessTablePaginationState>
  selectedKeys: Ref<HeadlessTableRowKey[]>
  columnVisibility: Ref<HeadlessTableColumnVisibilityState>
  columnOrder: Ref<HeadlessTableColumnOrderState>
}

export interface HeadlessTableInitialState {
  sorting?: HeadlessTableSortingState
  filters?: HeadlessTableFiltersState
  pagination?: Partial<HeadlessTablePaginationState>
  selectedKeys?: HeadlessTableRowKey[]
  columnVisibility?: HeadlessTableColumnVisibilityState
  columnOrder?: HeadlessTableColumnOrderState
}

export interface UseHeadlessTableOptions<TRow extends HeadlessTableRow = HeadlessTableRow> {
  data: MaybeRefOrGetter<readonly TRow[]>
  columns: MaybeRefOrGetter<readonly HeadlessTableColumn<TRow>[]>
  getRowId: (row: TRow, rowIndex: number) => HeadlessTableRowKey
  state?: Partial<HeadlessTableControlledState>
  initialState?: HeadlessTableInitialState
  manualFiltering?: boolean
  manualSorting?: boolean
  manualPagination?: boolean
  /** Total row count supplied by the server when manualPagination is enabled. */
  total?: MaybeRefOrGetter<number>
}

export interface UseHeadlessTableReturn<TRow extends HeadlessTableRow = HeadlessTableRow>
  extends HeadlessTableControlledState {
  allColumns: ComputedRef<HeadlessTableColumn<TRow>[]>
  columns: ComputedRef<HeadlessTableColumn<TRow>[]>
  allRows: ComputedRef<TRow[]>
  filteredRows: ComputedRef<TRow[]>
  sortedRows: ComputedRef<TRow[]>
  rows: ComputedRef<TRow[]>
  total: ComputedRef<number>
  pageCount: ComputedRef<number>
  selectedCount: ComputedRef<number>
  hasSelection: ComputedRef<boolean>
  setSorting: (sorting: HeadlessTableSortingState) => void
  toggleSorting: (columnId: string, multiple?: boolean) => void
  setFilter: (columnId: string, value: unknown) => void
  resetFilters: () => void
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setSelectedKeys: (keys: HeadlessTableRowKey[]) => void
  toggleRowSelected: (row: TRow, rowIndex: number, selected?: boolean) => void
  isRowSelected: (row: TRow, rowIndex: number) => boolean
  clearSelection: () => void
  setColumnVisible: (columnId: string, visible: boolean) => void
  toggleColumnVisible: (columnId: string) => void
  setColumnOrder: (columnIds: string[]) => void
  reset: () => void
}
