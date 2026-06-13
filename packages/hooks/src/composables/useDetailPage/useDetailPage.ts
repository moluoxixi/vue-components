import type { UseDetailPageOptions, UseDetailPageReturn } from '../../types'
import { useQuery } from '@tanstack/vue-query'
import { computed, toValue } from 'vue'
import { normalizeQueryKey } from '../../utils'

/**
 * 详情页场景 Hook。
 *
 * 依据响应式主键拉取单条详情：主键为空（null/undefined）时自动禁用查询，
 * 避免无主键时发起无意义请求；主键变化时查询键随之变化并自动重拉。
 *
 * @template TDetail 详情数据类型
 * @template TId 主键类型
 */
export function useDetailPage<TDetail, TId = string | number>(
  options: UseDetailPageOptions<TDetail, TId>,
): UseDetailPageReturn<TDetail, TId> {
  const currentId = computed<TId | null | undefined>(() => toValue(options.id))
  // 仅当主键非空且外部 enabled 为真时才启用查询。
  const isEnabled = computed<boolean>(() => {
    const id = currentId.value
    return id !== null && id !== undefined && toValue(options.enabled ?? true)
  })

  const queryKey = computed(() => [...normalizeQueryKey(options.queryKey), currentId.value])

  const query = useQuery<TDetail, Error>({
    queryKey,
    queryFn: (): Promise<TDetail> => {
      const id = currentId.value
      // isEnabled 已保证此处主键非空；显式收窄类型，避免把空值传给业务 fetcher。
      if (id === null || id === undefined) {
        return Promise.reject(new Error('useDetailPage: id is required when query is enabled'))
      }
      return options.fetcher(id)
    },
    enabled: isEnabled,
    staleTime: options.staleTime,
  })

  return {
    detail: computed(() => query.data.value),
    id: currentId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    isEnabled,
    refetch: () => query.refetch(),
    query,
  }
}
