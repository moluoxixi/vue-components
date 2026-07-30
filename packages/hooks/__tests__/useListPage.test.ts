import type { ListResult } from '../src/types'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useListPage } from '../src/composables'
import { waitFor, withSetup } from './test-utils'

interface Row { id: number, name: string }

/**
 * 构造一个可断言调用入参的 fetcher，返回固定形状的分页结果。
 */
function makeFetcher() {
  return vi.fn(async (params: { pagination: { page: number, pageSize: number }, filters: Record<string, unknown> }): Promise<ListResult<Row>> => {
    const { page, pageSize } = params.pagination
    return {
      list: [{ id: page, name: `row-${page}-${pageSize}` }],
      total: 42,
    }
  })
}

describe('useListPage', () => {
  it('使用默认分页发起首次查询并暴露 list/total/pageCount', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row>({ queryKey: 'rows', fetcher }))

    await waitFor(() => !result.isLoading.value)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0].pagination).toEqual({ page: 1, pageSize: 10 })
    expect(result.list.value).toEqual([{ id: 1, name: 'row-1-10' }])
    expect(result.total.value).toBe(42)
    // 42 / 10 -> 5 页
    expect(result.pageCount.value).toBe(5)
    unmount()
  })

  it('setPage 改变页码并触发携带新分页的再次查询', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row>({ queryKey: 'rows', fetcher }))
    await waitFor(() => !result.isLoading.value)

    result.setPage(3)
    await nextTick()
    await waitFor(() => fetcher.mock.calls.length >= 2)

    const lastCall = fetcher.mock.calls.at(-1)![0]
    expect(lastCall.pagination.page).toBe(3)
    expect(result.pagination.value.page).toBe(3)
    unmount()
  })

  it('setPage 越界时收敛到合法范围 [1, pageCount]', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row>({ queryKey: 'rows', fetcher }))
    await waitFor(() => !result.isLoading.value)

    result.setPage(999)
    expect(result.pagination.value.page).toBe(5)
    result.setPage(-3)
    expect(result.pagination.value.page).toBe(1)
    unmount()
  })

  it('setPageSize 重置回第一页', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row>({ queryKey: 'rows', fetcher, initialPagination: { page: 4, pageSize: 10 } }))
    await waitFor(() => !result.isLoading.value)

    result.setPageSize(20)
    expect(result.pagination.value).toEqual({ page: 1, pageSize: 20 })
    unmount()
  })

  it('setFilters 合并过滤条件并重置页码，resetFilters 还原初始值', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row, { keyword: string, status: string }>({
      queryKey: 'rows',
      fetcher,
      initialFilters: { keyword: '', status: 'all' },
      initialPagination: { page: 3, pageSize: 10 },
    }))
    await waitFor(() => !result.isLoading.value)

    result.setFilters({ keyword: 'abc' })
    expect(result.filters.value).toEqual({ keyword: 'abc', status: 'all' })
    expect(result.pagination.value.page).toBe(1)

    // 过滤变化应驱动携带新 filters 的再次查询
    await nextTick()
    await waitFor(() => fetcher.mock.calls.length >= 2)
    const lastCall = fetcher.mock.calls.at(-1)![0]
    expect(lastCall.filters).toEqual({ keyword: 'abc', status: 'all' })
    expect(lastCall.pagination.page).toBe(1)

    result.setPage(2)
    result.resetFilters()
    expect(result.filters.value).toEqual({ keyword: '', status: 'all' })
    expect(result.pagination.value.page).toBe(1)
    unmount()
  })

  it('enabled 为 false 时不发起查询', async () => {
    const fetcher = makeFetcher()
    const { result, unmount } = withSetup(() => useListPage<Row>({ queryKey: 'rows', fetcher, enabled: false }))
    await nextTick()
    await new Promise(r => setTimeout(r, 50))

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.list.value).toEqual([])
    unmount()
  })
})
