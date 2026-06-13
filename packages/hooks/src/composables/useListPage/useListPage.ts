import type { ListQueryParams, ListResult, PaginationState, UseListPageOptions, UseListPageReturn } from '../../types'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref, toValue } from 'vue'
import { normalizeQueryKey } from '../../utils'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

/**
 * 列表页场景 Hook。
 *
 * 一体化管理「分页 + 过滤」请求状态：内部维护可写的分页与过滤响应式状态，
 * 将其作为查询键的一部分驱动 TanStack Query 自动重新拉取，
 * 业务方只需提供 fetcher 与查询键基段。
 *
 * @template TItem 列表项类型
 * @template TFilter 业务过滤条件类型
 */
export function useListPage<
  TItem,
  TFilter extends Record<string, unknown> = Record<string, unknown>,
>(options: UseListPageOptions<TItem, TFilter>): UseListPageReturn<TItem, TFilter> {
  const initialPagination: PaginationState = {
    page: options.initialPagination?.page ?? DEFAULT_PAGE,
    pageSize: options.initialPagination?.pageSize ?? DEFAULT_PAGE_SIZE,
  }
  // 保留初始过滤条件副本，供 resetFilters 还原。
  const initialFilters = { ...(options.initialFilters ?? ({} as TFilter)) }

  const pagination = ref<PaginationState>({ ...initialPagination })
  const filters = ref<TFilter>({ ...initialFilters }) as UseListPageReturn<TItem, TFilter>['filters']

  // 查询键随分页与过滤变化，TanStack Query 据此自动触发新请求并缓存各组合结果。
  const queryKey = computed(() => [
    ...normalizeQueryKey(options.queryKey),
    {
      pagination: { page: pagination.value.page, pageSize: pagination.value.pageSize },
      filters: filters.value,
    },
  ])

  const query = useQuery<ListResult<TItem>, Error>({
    queryKey,
    queryFn: (): Promise<ListResult<TItem>> => {
      const params: ListQueryParams<TFilter> = {
        pagination: { page: pagination.value.page, pageSize: pagination.value.pageSize },
        filters: filters.value,
      }
      return options.fetcher(params)
    },
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: options.staleTime,
    placeholderData: previous => previous,
  })

  const list = computed<TItem[]>(() => query.data.value?.list ?? [])
  const total = computed<number>(() => query.data.value?.total ?? 0)
  const pageCount = computed<number>(() => {
    const size = pagination.value.pageSize
    return size > 0 ? Math.ceil(total.value / size) : 0
  })

  /**
   * 跳转到指定页。
   *
   * 页码下限收敛到 1；当已知总页数时不超过 pageCount，避免请求空页。
   */
  function setPage(page: number): void {
    const max = pageCount.value > 0 ? pageCount.value : Number.POSITIVE_INFINITY
    pagination.value.page = Math.min(Math.max(1, Math.trunc(page)), max)
  }

  /**
   * 修改单页条数。
   *
   * 条数变化会改变分页边界，按惯例重置回第一页。
   */
  function setPageSize(pageSize: number): void {
    pagination.value.pageSize = Math.max(1, Math.trunc(pageSize))
    pagination.value.page = DEFAULT_PAGE
  }

  /**
   * 合并更新过滤条件并回到第一页。
   */
  function setFilters(next: Partial<TFilter>): void {
    filters.value = { ...filters.value, ...next }
    pagination.value.page = DEFAULT_PAGE
  }

  /**
   * 重置过滤条件为初始值并回到第一页。
   */
  function resetFilters(): void {
    filters.value = { ...initialFilters }
    pagination.value.page = DEFAULT_PAGE
  }

  return {
    list,
    total,
    pageCount,
    pagination,
    filters,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    setPage,
    setPageSize,
    setFilters,
    resetFilters,
    refetch: () => query.refetch(),
    query,
  }
}
