import type { HeadlessTableColumn, HeadlessTablePaginationState } from '../index'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useHeadlessTable } from '../index'

interface ProductRow {
  id: number
  name: string
  price: number
  status: 'active' | 'disabled'
}

const rows: ProductRow[] = [
  { id: 1, name: 'Beta', price: 30, status: 'active' },
  { id: 2, name: 'Alpha', price: 10, status: 'active' },
  { id: 3, name: 'Gamma', price: 20, status: 'disabled' },
]

const columns: HeadlessTableColumn<ProductRow>[] = [
  { field: 'name', title: '名称' },
  { field: 'price', title: '价格' },
  { id: 'status-label', accessor: row => row.status, title: '状态' },
  { id: 'actions', title: '操作' },
]

describe('useHeadlessTable', () => {
  it('组合客户端过滤、排序和分页数据管线', () => {
    const table = useHeadlessTable({
      columns,
      data: rows,
      getRowId: row => row.id,
      initialState: { pagination: { currentPage: 1, pageSize: 2 } },
    })

    expect(table.rows.value.map(row => row.id)).toEqual([1, 2])
    table.toggleSorting('price')
    expect(table.rows.value.map(row => row.id)).toEqual([2, 3])
    table.setPage(2)
    expect(table.rows.value.map(row => row.id)).toEqual([1])

    table.setFilter('status-label', 'active')
    expect(table.pagination.value.currentPage).toBe(1)
    expect(table.rows.value.map(row => row.id)).toEqual([2, 1])
    expect(table.total.value).toBe(2)
    expect(table.pageCount.value).toBe(1)

    table.toggleSorting('price')
    expect(table.rows.value.map(row => row.id)).toEqual([1, 2])
    table.toggleSorting('price')
    expect(table.sorting.value).toEqual([])
  })

  it('支持受控状态与服务端手动数据模式', () => {
    const pagination = ref<HeadlessTablePaginationState>({ currentPage: 3, pageSize: 20 })
    const table = useHeadlessTable({
      columns,
      data: rows.slice(0, 1),
      getRowId: row => row.id,
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
      total: 45,
      state: { pagination },
    })

    table.setFilter('name', 'does-not-filter-client-side')
    table.setSorting([{ id: 'price', direction: 'desc' }])
    table.setPage(2)

    expect(table.rows.value).toEqual(rows.slice(0, 1))
    expect(table.total.value).toBe(45)
    expect(table.pageCount.value).toBe(3)
    expect(pagination.value).toEqual({ currentPage: 2, pageSize: 20 })
  })

  it('管理选择、列显隐、列顺序并可恢复初始状态', () => {
    const table = useHeadlessTable({
      columns,
      data: rows,
      getRowId: row => row.id,
      initialState: {
        columnOrder: ['price', 'name'],
        columnVisibility: { actions: false },
        selectedKeys: [1],
      },
    })

    expect(table.allColumns.value.slice(0, 2).map(column => column.field)).toEqual(['price', 'name'])
    expect(table.columns.value.map(column => column.id ?? column.field)).not.toContain('actions')
    expect(table.isRowSelected(rows[0], 0)).toBe(true)

    table.toggleRowSelected(rows[1], 1)
    table.toggleColumnVisible('actions')
    table.setColumnOrder(['status-label', 'name'])
    expect(table.selectedKeys.value).toEqual([1, 2])
    expect(table.selectedCount.value).toBe(2)
    expect(table.hasSelection.value).toBe(true)
    expect(table.columns.value.map(column => column.id ?? column.field)).toContain('actions')
    expect(table.allColumns.value[0].id).toBe('status-label')

    table.reset()
    expect(table.selectedKeys.value).toEqual([1])
    expect(table.columnVisibility.value).toEqual({ actions: false })
    expect(table.columnOrder.value).toEqual(['price', 'name'])
  })

  it('保持多列排序优先级，并在数据缩减后收敛越界页码', () => {
    const data = ref([...rows])
    const table = useHeadlessTable({
      columns,
      data,
      getRowId: row => row.id,
      initialState: { pagination: { currentPage: 2, pageSize: 2 } },
    })

    table.setSorting([
      { id: 'price', direction: 'asc' },
      { id: 'name', direction: 'asc' },
    ])
    table.toggleSorting('price', true)
    expect(table.sorting.value).toEqual([
      { id: 'price', direction: 'desc' },
      { id: 'name', direction: 'asc' },
    ])

    data.value = rows.slice(0, 1)
    expect(table.pagination.value.currentPage).toBe(1)
    expect(table.rows.value).toEqual(rows.slice(0, 1))
  })

  it('保护初始状态快照并归一化非法分页值', () => {
    const table = useHeadlessTable({
      columns,
      data: rows,
      getRowId: row => row.id,
      initialState: {
        filters: { nested: { query: 'initial' } },
        pagination: { currentPage: Number.NaN, pageSize: Number.NaN },
      },
    })

    const nested = table.filters.value.nested as { query: string }
    nested.query = 'changed'
    table.reset()
    expect(table.filters.value).toEqual({ nested: { query: 'initial' } })
    expect(table.pagination.value).toEqual({ currentPage: 1, pageSize: 10 })

    table.setPage(Number.NaN)
    table.setPageSize(Number.POSITIVE_INFINITY)
    expect(table.pagination.value).toEqual({ currentPage: 1, pageSize: 10 })
  })
})
