import type { UseQueryReturnType } from '@tanstack/vue-query'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { QueryKeyBase } from './common'

/**
 * useDetailPage 配置项。
 *
 * @template TDetail 详情数据类型
 * @template TId 主键类型，默认 string | number
 */
export interface UseDetailPageOptions<TDetail, TId = string | number> {
  /** 查询键基段，最终查询键为 [...base, id]。 */
  queryKey: QueryKeyBase
  /** 详情数据获取函数，接收当前主键。 */
  fetcher: (id: TId) => Promise<TDetail>
  /** 响应式主键来源，为空（null/undefined）时自动禁用查询。 */
  id: MaybeRefOrGetter<TId | null | undefined>
  /** 额外的启用开关，与「主键非空」条件取与。 */
  enabled?: MaybeRefOrGetter<boolean>
  /** 数据保鲜时间（毫秒）。 */
  staleTime?: number
}

/**
 * useDetailPage 返回契约。
 */
export interface UseDetailPageReturn<TDetail, TId = string | number> {
  /** 详情数据，未加载时为 undefined。 */
  detail: ComputedRef<TDetail | undefined>
  /** 当前生效的主键。 */
  id: ComputedRef<TId | null | undefined>
  /** 是否首次加载中。 */
  isLoading: Ref<boolean>
  /** 是否正在后台刷新。 */
  isFetching: Ref<boolean>
  /** 是否处于错误态。 */
  isError: Ref<boolean>
  /** 错误对象。 */
  error: Ref<Error | null>
  /** 查询是否处于启用状态（主键非空且 enabled 为真）。 */
  isEnabled: ComputedRef<boolean>
  /** 手动重新拉取详情。 */
  refetch: () => Promise<unknown>
  /** 底层 vue-query 查询对象。 */
  query: UseQueryReturnType<TDetail, Error>
}
