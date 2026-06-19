import type { UseRequestOptionsOptions, UseRequestOptionsReturn } from '../../types'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { normalizeQueryKey } from '../../utils'

/**
 * 请求选项 Hook。
 *
 * 将业务 params 作为查询键的一部分，交给 TanStack Query 缓存选项数组。
 */
export function useRequestOptions<
  TOption,
  TParams extends Record<string, unknown> = Record<string, unknown>,
>(options: UseRequestOptionsOptions<TOption, TParams>): UseRequestOptionsReturn<TOption> {
  const params = computed<TParams>(() => toValue(options.params) ?? ({} as TParams))
  const queryKey = computed(() => [
    ...normalizeQueryKey(options.queryKey),
    params.value,
  ])

  const query = useQuery<TOption[], Error>({
    queryKey,
    queryFn: () => options.query(params.value),
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: options.staleTime,
    placeholderData: previous => previous,
  })

  return {
    options: computed(() => query.data.value ?? []),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    query,
  }
}
