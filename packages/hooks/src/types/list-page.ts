import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { ListQueryParams, ListResult, PaginationState, QueryKeyBase } from './common'

/**
 * useListPage 配置项。
 *
 * @template TItem 列表项类型
 * @template TFilter 业务过滤条件类型
 */
export interface UseListPageOptions<
  TItem,
  TFilter extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 查询键基段，最终查询键为 [...base, { pagination, filters }]。 */
  queryKey: QueryKeyBase
  /** 列表数据获取函数，由业务方实现具体的请求逻辑。 */
  fetcher: (params: ListQueryParams<TFilter>) => Promise<ListResult<TItem>>
  /** 初始分页状态，默认 page=1、pageSize=10。 */
  initialPagination?: Partial<PaginationState>
  /** 初始过滤条件。 */
  initialFilters?: TFilter
  /** 是否启用查询，可传响应式值以延迟首查。 */
  enabled?: MaybeRefOrGetter<boolean>
  /** 数据保鲜时间（毫秒），透传给底层 useQuery。 */
  staleTime?: number
}

/**
 * useListPage 返回契约。
 *
 * 暴露列表数据、分页状态与读写方法、过滤条件读写方法，以及底层查询对象。
 */
export interface UseListPageReturn<
  TItem,
  TFilter extends Record<string, unknown> = Record<string, unknown>,
> {
  /** 当前页列表数据，未加载时为空数组。 */
  list: ComputedRef<TItem[]>
  /** 符合过滤条件的总记录数。 */
  total: ComputedRef<number>
  /** 总页数，依据 total 与 pageSize 计算。 */
  pageCount: ComputedRef<number>
  /** 可写分页状态。 */
  pagination: Ref<PaginationState>
  /** 可写过滤条件。 */
  filters: Ref<TFilter>
  /** 是否首次加载中。 */
  isLoading: Ref<boolean>
  /** 是否正在后台刷新。 */
  isFetching: Ref<boolean>
  /** 是否处于错误态。 */
  isError: Ref<boolean>
  /** 错误对象。 */
  error: Ref<Error | null>
  /** 跳转到指定页，越界会被收敛到合法范围。 */
  setPage: (page: number) => void
  /** 修改单页条数并重置回第一页。 */
  setPageSize: (pageSize: number) => void
  /** 合并更新过滤条件并重置回第一页。 */
  setFilters: (next: Partial<TFilter>) => void
  /** 重置过滤条件为初始值并回到第一页。 */
  resetFilters: () => void
  /** 手动重新拉取当前页。 */
  refetch: () => Promise<unknown>
  /** 底层 vue-query 查询对象，便于高级用法。 */
  query: UseQueryReturnType<ListResult<TItem>, Error>
}
