import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { HeadlessTableColumn, HeadlessTableRow, HeadlessTableRowKey } from './table'

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
