import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { QueryKeyBase, RequestTableQuery, RequestTableResult } from './common'

/**
 * 接口缓存表格 Hook 配置。
 *
 * query 接收业务 params 与分页参数的平铺合并对象。
 */
export interface UseRequestTableOptions<
  TItem,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: RequestTableQuery<TItem, TParams>
  params?: MaybeRefOrGetter<TParams>
  currentPage?: MaybeRefOrGetter<number>
  pageSize?: MaybeRefOrGetter<number>
  defaultCurrentPage?: number
  defaultPageSize?: number
  resetPageOnParamsChange?: boolean
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

/**
 * 接口缓存表格 Hook 返回契约。
 */
export interface UseRequestTableReturn<TItem> {
  data: ComputedRef<TItem[]>
  total: ComputedRef<number>
  currentPage: Ref<number>
  pageSize: Ref<number>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  setCurrentPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<RequestTableResult<TItem>, Error>
}
