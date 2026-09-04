import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useRequestTable } from '../src/composables'
import { createTestQueryClient, waitFor, withSetup } from './test-utils'

interface Row {
  id: number
  name: string
}

describe('useRequestTable', () => {
  it('uses params and pagination as the query key', async () => {
    const params = ref({ keyword: 'warehouse' })
    const query = vi.fn(async (input: { keyword: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: `${input.keyword}-${input.pageSize}` }],
      total: 23,
    }))
    const queryClient = createTestQueryClient()
    const { result, unmount } = withSetup(() => useRequestTable<Row, { keyword: string }>({
      queryKey: 'request-table',
      query,
      params,
      defaultCurrentPage: 2,
      defaultPageSize: 5,
    }), queryClient)

    await waitFor(() => result.data.value.length === 1)

    expect(result.data.value).toEqual([{ id: 2, name: 'warehouse-5' }])
    expect(result.total.value).toBe(23)
    expect(queryClient.getQueryData(['request-table', { keyword: 'warehouse' }, { currentPage: 2, pageSize: 5 }])).toEqual({
      data: [{ id: 2, name: 'warehouse-5' }],
      total: 23,
    })

    result.setCurrentPage(3)
    await waitFor(() => result.data.value[0]?.id === 3)

    expect(query).toHaveBeenLastCalledWith({ keyword: 'warehouse', currentPage: 3, pageSize: 5 })

    unmount()
  })

  it('resets current page when page size or params change', async () => {
    const params = ref({ status: 'active' })
    const query = vi.fn(async (input: { status: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: input.status }],
      total: 100,
    }))
    const { result, unmount } = withSetup(() => useRequestTable<Row, { status: string }>({
      queryKey: 'reset-table',
      query,
      params,
      defaultCurrentPage: 4,
      defaultPageSize: 20,
    }))

    await waitFor(() => result.data.value.length === 1)
    expect(result.currentPage.value).toBe(4)

    result.setPageSize(50)
    expect(result.currentPage.value).toBe(1)
    expect(result.pageSize.value).toBe(50)

    result.setCurrentPage(3)
    params.value = { status: 'disabled' }
    await waitFor(() => result.currentPage.value === 1)
    await waitFor(() => query.mock.calls.at(-1)?.[0].status === 'disabled')

    expect(query).toHaveBeenLastCalledWith({ status: 'disabled', currentPage: 1, pageSize: 50 })

    unmount()
  })

  it('can keep current page when params change', async () => {
    const params = ref({ status: 'active' })
    const query = vi.fn(async (input: { status: string, currentPage: number, pageSize: number }) => ({
      data: [{ id: input.currentPage, name: input.status }],
      total: 100,
    }))
    const { result, unmount } = withSetup(() => useRequestTable<Row, { status: string }>({
      queryKey: 'keep-page-table',
      query,
      params,
      defaultCurrentPage: 4,
      defaultPageSize: 20,
      resetPageOnParamsChange: false,
    }))

    await waitFor(() => result.data.value.length === 1)
    expect(result.currentPage.value).toBe(4)

    params.value = { status: 'disabled' }
    await waitFor(() => query.mock.calls.at(-1)?.[0].status === 'disabled')

    expect(query).toHaveBeenLastCalledWith({ status: 'disabled', currentPage: 4, pageSize: 20 })

    unmount()
  })

  it('resets current page after a deep params mutation', async () => {
    const params = ref({ filters: { status: 'active' } })
    const { result, unmount } = withSetup(() => useRequestTable<Row, { filters: { status: string } }>({
      queryKey: 'deep-params-table',
      query: vi.fn(),
      params,
      enabled: false,
      defaultCurrentPage: 4,
    }))

    expect(result.currentPage.value).toBe(4)
    params.value.filters.status = 'disabled'
    await nextTick()
    expect(result.currentPage.value).toBe(1)

    unmount()
  })

  it('reuses external page refs and tracks getter inputs with internal refs', async () => {
    const currentPage = ref(3)
    const pageSizeSource = ref(25)
    const { result, unmount } = withSetup(() => useRequestTable<Row>({
      queryKey: 'external-page-state',
      query: vi.fn(),
      enabled: false,
      currentPage,
      pageSize: () => pageSizeSource.value,
      defaultPageSize: 15,
    }))

    expect(result.currentPage).toBe(currentPage)
    expect(result.currentPage.value).toBe(3)
    expect(result.pageSize.value).toBe(15)

    result.setCurrentPage(4)
    expect(currentPage.value).toBe(4)

    pageSizeSource.value = 30
    await nextTick()
    expect(result.pageSize.value).toBe(30)

    unmount()
  })

  it('normalizes invalid and fractional pagination values', () => {
    const { result, unmount } = withSetup(() => useRequestTable<Row>({
      queryKey: 'normalized-page-state',
      query: vi.fn(),
      enabled: false,
      defaultCurrentPage: Number.NaN,
      defaultPageSize: Number.POSITIVE_INFINITY,
    }))

    expect(result.currentPage.value).toBe(1)
    expect(result.pageSize.value).toBe(10)

    for (const value of [Number.NaN, Number.NEGATIVE_INFINITY, 0, -3]) {
      result.setCurrentPage(value)
      expect(result.currentPage.value).toBe(1)
    }
    result.setCurrentPage(2.9)
    expect(result.currentPage.value).toBe(2)

    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      result.setPageSize(value)
      expect(result.pageSize.value).toBe(10)
      expect(result.currentPage.value).toBe(1)
    }
    for (const value of [0, -5]) {
      result.setPageSize(value)
      expect(result.pageSize.value).toBe(1)
      expect(result.currentPage.value).toBe(1)
    }
    result.setPageSize(20.8)
    expect(result.pageSize.value).toBe(20)

    unmount()
  })
})
