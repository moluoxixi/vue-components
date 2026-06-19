import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { QueryKeyBase } from './common'

/**
 * 接口缓存选项 Hook 配置。
 *
 * query 固定返回选项数组；params 会作为查询键的一部分参与缓存。
 */
export interface UseRequestOptionsOptions<
  TOption,
  TParams extends Record<string, unknown> = Record<string, unknown>,
> {
  queryKey: QueryKeyBase
  query: (params: TParams) => Promise<TOption[]>
  params?: MaybeRefOrGetter<TParams>
  enabled?: MaybeRefOrGetter<boolean>
  staleTime?: number
}

/**
 * 接口缓存选项 Hook 返回契约。
 */
export interface UseRequestOptionsReturn<TOption> {
  options: ComputedRef<TOption[]>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  isError: Ref<boolean>
  error: Ref<Error | null>
  refetch: () => Promise<unknown>
  query: UseQueryReturnType<TOption[], Error>
}
