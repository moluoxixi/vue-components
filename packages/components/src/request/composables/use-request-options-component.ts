import type {
  RequestOptionRecord,
  RequestOptionsComponentEmits,
  RequestOptionsComponentProps,
  RequestParamsRecord,
} from '../types'
import { useRequestOptions } from '@moluoxixi/hooks'
import { computed, watch } from 'vue'

export function useRequestOptionsComponent<
  TOption extends RequestOptionRecord = RequestOptionRecord,
  TParams extends RequestParamsRecord = RequestParamsRecord,
>(
  props: Readonly<RequestOptionsComponentProps<TOption, TParams>>,
  emit: RequestOptionsComponentEmits<TOption>,
  fallbackCacheKey: string,
) {
  const request = useRequestOptions<TOption, TParams>({
    queryKey: props.cacheKey ?? fallbackCacheKey,
    query: props.query,
    params: computed(() => props.params ?? ({} as TParams)),
    enabled: computed(() => props.enabled ?? true),
    staleTime: props.staleTime,
  })

  const loading = computed(() => request.isLoading.value || request.isFetching.value)

  watch(
    () => request.query.data.value,
    (options) => {
      if (options)
        emit('loaded', options)
    },
  )

  watch(
    () => request.error.value,
    (error) => {
      if (error)
        emit('error', error)
    },
  )

  return {
    loading,
    options: request.options,
    refetch: request.refetch,
  }
}
