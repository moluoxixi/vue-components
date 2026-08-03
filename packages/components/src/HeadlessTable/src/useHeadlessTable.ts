import type { Ref } from 'vue'
import type {
  HeadlessTableColumn,
  HeadlessTableColumnVisibilityState,
  HeadlessTableFiltersState,
  HeadlessTablePaginationState,
  HeadlessTableRow,
  HeadlessTableRowKey,
  HeadlessTableSortingState,
  UseHeadlessTableOptions,
  UseHeadlessTableReturn,
} from './types'
import { computed, ref, toValue, watch } from 'vue'
import { getHeadlessTableColumnId, getHeadlessTableRawValue } from './core'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

function cloneState<T>(value: T): T {
  if (Array.isArray(value))
    return value.map(item => cloneState(item)) as T
  if (value instanceof Date)
    return new Date(value.getTime()) as T
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        cloneState(item),
      ])) as T
    }
  }

  return value
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0)
    return fallback

  return Math.trunc(value)
}

function nonNegativeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function controlledRef<T>(value: Ref<T> | undefined, initialValue: T): Ref<T> {
  return value ?? ref(initialValue) as Ref<T>
}

function compareValues(left: unknown, right: unknown): number {
  if (Object.is(left, right))
    return 0
  if (left == null)
    return 1
  if (right == null)
    return -1
  if (left instanceof Date && right instanceof Date)
    return left.getTime() - right.getTime()
  if (typeof left === 'number' && typeof right === 'number')
    return left - right

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function defaultFilter(value: unknown, filterValue: unknown): boolean {
  if (Array.isArray(filterValue))
    return filterValue.some(item => Object.is(item, value))

  return String(value ?? '')
    .toLocaleLowerCase()
    .includes(String(filterValue ?? '').toLocaleLowerCase())
}

export function useHeadlessTable<TRow extends HeadlessTableRow = HeadlessTableRow>(
  options: UseHeadlessTableOptions<TRow>,
): UseHeadlessTableReturn<TRow> {
  const initialState = options.initialState ?? {}
  const initialSorting = cloneState(initialState.sorting ?? [])
  const initialFilters = cloneState(initialState.filters ?? {})
  const initialPagination: HeadlessTablePaginationState = {
    currentPage: positiveInteger(initialState.pagination?.currentPage, DEFAULT_PAGE),
    pageSize: positiveInteger(initialState.pagination?.pageSize, DEFAULT_PAGE_SIZE),
  }
  const initialSelectedKeys = [...new Set(cloneState(initialState.selectedKeys ?? []))]
  const initialColumnVisibility = cloneState(initialState.columnVisibility ?? {})
  const initialColumnOrder = cloneState(initialState.columnOrder ?? [])

  const sorting = controlledRef(options.state?.sorting, cloneState(initialSorting))
  const filters = controlledRef(options.state?.filters, cloneState(initialFilters))
  const pagination = controlledRef(options.state?.pagination, cloneState(initialPagination))
  const selectedKeys = controlledRef(options.state?.selectedKeys, [...initialSelectedKeys])
  const columnVisibility = controlledRef(
    options.state?.columnVisibility,
    { ...initialColumnVisibility },
  )
  const columnOrder = controlledRef(options.state?.columnOrder, [...initialColumnOrder])

  const sourceColumns = computed<HeadlessTableColumn<TRow>[]>(() => [
    ...toValue(options.columns),
  ])
  const allRows = computed<TRow[]>(() => [...toValue(options.data)])

  const allColumns = computed<HeadlessTableColumn<TRow>[]>(() => {
    const order = new Map(columnOrder.value.map((id, index) => [id, index]))
    return sourceColumns.value
      .map((column, index) => ({ column, index }))
      .sort((left, right) => {
        const leftOrder = order.get(getHeadlessTableColumnId(left.column, left.index))
        const rightOrder = order.get(getHeadlessTableColumnId(right.column, right.index))
        if (leftOrder == null && rightOrder == null)
          return left.index - right.index
        if (leftOrder == null)
          return 1
        if (rightOrder == null)
          return -1
        return leftOrder - rightOrder
      })
      .map(item => item.column)
  })

  const columns = computed<HeadlessTableColumn<TRow>[]>(() => allColumns.value.filter(
    (column, index) => {
      const id = getHeadlessTableColumnId(column, index)
      return Object.hasOwn(columnVisibility.value, id)
        ? columnVisibility.value[id] !== false
        : column.visible !== false
    },
  ))

  const filteredRows = computed<TRow[]>(() => {
    if (options.manualFiltering)
      return [...allRows.value]

    const activeFilters = Object.entries(filters.value)
      .filter(([, filterValue]) => filterValue !== undefined)
    if (activeFilters.length === 0)
      return [...allRows.value]

    const columnById = new Map(sourceColumns.value.map((column, index) => [
      getHeadlessTableColumnId(column, index),
      column,
    ]))

    return allRows.value.filter((row, rowIndex) => activeFilters.every(([columnId, filterValue]) => {
      const column = columnById.get(columnId)
      if (!column)
        return true

      const value = getHeadlessTableRawValue(row, column, rowIndex)
      return column.filter
        ? column.filter(value, filterValue, row)
        : defaultFilter(value, filterValue)
    }))
  })

  const sortedRows = computed<TRow[]>(() => {
    if (options.manualSorting || sorting.value.length === 0)
      return [...filteredRows.value]

    const columnById = new Map(sourceColumns.value.map((column, index) => [
      getHeadlessTableColumnId(column, index),
      column,
    ]))

    return filteredRows.value
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        for (const rule of sorting.value) {
          const column = columnById.get(rule.id)
          if (!column)
            continue

          const result = column.sorter
            ? column.sorter(left.row, right.row)
            : compareValues(
                getHeadlessTableRawValue(left.row, column, left.index),
                getHeadlessTableRawValue(right.row, column, right.index),
              )
          if (result !== 0)
            return rule.direction === 'desc' ? -result : result
        }

        return left.index - right.index
      })
      .map(item => item.row)
  })

  const total = computed<number>(() => options.manualPagination
    ? nonNegativeNumber(toValue(options.total ?? allRows.value.length))
    : sortedRows.value.length)

  const pageCount = computed<number>(() => {
    const pageSize = positiveInteger(pagination.value.pageSize, DEFAULT_PAGE_SIZE)
    return Math.ceil(total.value / pageSize)
  })

  watch(pageCount, (count) => {
    const maximum = Math.max(DEFAULT_PAGE, count)
    const currentPage = positiveInteger(pagination.value.currentPage, DEFAULT_PAGE)
    const pageSize = positiveInteger(pagination.value.pageSize, DEFAULT_PAGE_SIZE)
    if (currentPage !== pagination.value.currentPage
      || pageSize !== pagination.value.pageSize
      || currentPage > maximum) {
      pagination.value = {
        currentPage: Math.min(currentPage, maximum),
        pageSize,
      }
    }
  }, { flush: 'sync' })

  const rows = computed<TRow[]>(() => {
    if (options.manualPagination)
      return [...sortedRows.value]

    const pageSize = positiveInteger(pagination.value.pageSize, DEFAULT_PAGE_SIZE)
    const currentPage = Math.min(
      positiveInteger(pagination.value.currentPage, DEFAULT_PAGE),
      Math.max(DEFAULT_PAGE, pageCount.value),
    )
    const start = (currentPage - 1) * pageSize
    return sortedRows.value.slice(start, start + pageSize)
  })

  const selectedCount = computed(() => selectedKeys.value.length)
  const hasSelection = computed(() => selectedCount.value > 0)

  function setSorting(nextSorting: HeadlessTableSortingState): void {
    sorting.value = cloneState(nextSorting)
    pagination.value = { ...pagination.value, currentPage: DEFAULT_PAGE }
  }

  function toggleSorting(columnId: string, multiple = false): void {
    const currentIndex = sorting.value.findIndex(rule => rule.id === columnId)
    const current = sorting.value[currentIndex]

    if (!multiple) {
      setSorting(!current
        ? [{ id: columnId, direction: 'asc' }]
        : current.direction === 'asc'
          ? [{ id: columnId, direction: 'desc' }]
          : [])
      return
    }

    const nextSorting = cloneState(sorting.value)
    if (!current)
      nextSorting.push({ id: columnId, direction: 'asc' })
    else if (current.direction === 'asc')
      nextSorting.splice(currentIndex, 1, { id: columnId, direction: 'desc' })
    else
      nextSorting.splice(currentIndex, 1)
    setSorting(nextSorting)
  }

  function setFilter(columnId: string, value: unknown): void {
    const nextFilters: HeadlessTableFiltersState = { ...filters.value }
    if (value === undefined)
      delete nextFilters[columnId]
    else
      nextFilters[columnId] = value
    filters.value = nextFilters
    pagination.value = { ...pagination.value, currentPage: DEFAULT_PAGE }
  }

  function resetFilters(): void {
    filters.value = { ...initialFilters }
    pagination.value = { ...pagination.value, currentPage: DEFAULT_PAGE }
  }

  function setPage(page: number): void {
    const maximum = Math.max(1, pageCount.value)
    pagination.value = {
      ...pagination.value,
      currentPage: Math.min(positiveInteger(page, DEFAULT_PAGE), maximum),
    }
  }

  function setPageSize(pageSize: number): void {
    pagination.value = {
      currentPage: DEFAULT_PAGE,
      pageSize: positiveInteger(pageSize, DEFAULT_PAGE_SIZE),
    }
  }

  function setSelectedKeys(keys: HeadlessTableRowKey[]): void {
    selectedKeys.value = [...new Set(keys)]
  }

  function isRowSelected(row: TRow, rowIndex: number): boolean {
    return selectedKeys.value.includes(options.getRowId(row, rowIndex))
  }

  function toggleRowSelected(row: TRow, rowIndex: number, selected?: boolean): void {
    const key = options.getRowId(row, rowIndex)
    const currentlySelected = selectedKeys.value.includes(key)
    const shouldSelect = selected ?? !currentlySelected
    setSelectedKeys(shouldSelect
      ? [...selectedKeys.value, key]
      : selectedKeys.value.filter(selectedKey => selectedKey !== key))
  }

  function clearSelection(): void {
    selectedKeys.value = []
  }

  function setColumnVisible(columnId: string, visible: boolean): void {
    const nextVisibility: HeadlessTableColumnVisibilityState = {
      ...columnVisibility.value,
      [columnId]: visible,
    }
    columnVisibility.value = nextVisibility
  }

  function toggleColumnVisible(columnId: string): void {
    const columnIndex = sourceColumns.value.findIndex((column, index) => (
      getHeadlessTableColumnId(column, index) === columnId
    ))
    const column = sourceColumns.value[columnIndex]
    if (!column)
      return

    const current = Object.hasOwn(columnVisibility.value, columnId)
      ? columnVisibility.value[columnId] !== false
      : column.visible !== false
    setColumnVisible(columnId, !current)
  }

  function setColumnOrder(columnIds: string[]): void {
    columnOrder.value = [...new Set(columnIds)]
  }

  function reset(): void {
    sorting.value = cloneState(initialSorting)
    filters.value = cloneState(initialFilters)
    pagination.value = cloneState(initialPagination)
    selectedKeys.value = [...initialSelectedKeys]
    columnVisibility.value = { ...initialColumnVisibility }
    columnOrder.value = [...initialColumnOrder]
  }

  return {
    allColumns,
    columns,
    allRows,
    filteredRows,
    sortedRows,
    rows,
    total,
    pageCount,
    sorting,
    filters,
    pagination,
    selectedKeys,
    columnVisibility,
    columnOrder,
    selectedCount,
    hasSelection,
    setSorting,
    toggleSorting,
    setFilter,
    resetFilters,
    setPage,
    setPageSize,
    setSelectedKeys,
    toggleRowSelected,
    isRowSelected,
    clearSelection,
    setColumnVisible,
    toggleColumnVisible,
    setColumnOrder,
    reset,
  }
}
