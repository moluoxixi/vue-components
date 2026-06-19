import type { Ref } from 'vue'
import type { UseRequestTableOptions, UseRequestTableReturn } from '../../types'
import { useQuery } from '@tanstack/vue-query'
import { computed, isRef, ref, toValue, watch } from 'vue'
import { normalizeQueryKey } from '../../utils'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value))
    return fallback

  return Math.max(1, Math.trunc(value))
}

function createWritablePageRef(input: unknown, fallback: number): Ref<number> {
  if (isRef(input))
    return input as Ref<number>

  return ref(normalizePositiveInteger(input as number | undefined, fallback))
}

/**
 * 请求表格 Hook。
 *
 * 将业务 params 与分页状态平铺传给业务 query，并把二者一起纳入查询键。
 */
export function useRequestTable<
  TItem,
  TParams extends Record<string, unknown> = Record<string, unknown>,
>(options: UseRequestTableOptions<TItem, TParams>): UseRequestTableReturn<TItem> {
  const params = computed<TParams>(() => toValue(options.params) ?? ({} as TParams))
  const currentPage = createWritablePageRef(
    options.currentPage,
    normalizePositiveInteger(options.defaultCurrentPage, DEFAULT_PAGE),
  )
  const pageSize = createWritablePageRef(
    options.pageSize,
    normalizePositiveInteger(options.defaultPageSize, DEFAULT_PAGE_SIZE),
  )

  if (!isRef(options.currentPage) && options.currentPage !== undefined) {
    watch(
      () => toValue(options.currentPage),
      value => currentPage.value = normalizePositiveInteger(value, DEFAULT_PAGE),
    )
  }

  if (!isRef(options.pageSize) && options.pageSize !== undefined) {
    watch(
      () => toValue(options.pageSize),
      value => pageSize.value = normalizePositiveInteger(value, DEFAULT_PAGE_SIZE),
    )
  }

  watch(
    params,
    () => {
      if (options.resetPageOnParamsChange ?? true)
        currentPage.value = DEFAULT_PAGE
    },
    { deep: true },
  )

  const queryKey = computed(() => [
    ...normalizeQueryKey(options.queryKey),
    params.value,
    { currentPage: currentPage.value, pageSize: pageSize.value },
  ])

  const query = useQuery({
    queryKey,
    queryFn: () => options.query({
      ...params.value,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    }),
    enabled: computed(() => toValue(options.enabled ?? true)),
    staleTime: options.staleTime,
    placeholderData: previous => previous,
  })

  function setCurrentPage(page: number): void {
    currentPage.value = normalizePositiveInteger(page, DEFAULT_PAGE)
  }

  function setPageSize(nextPageSize: number): void {
    pageSize.value = normalizePositiveInteger(nextPageSize, DEFAULT_PAGE_SIZE)
    currentPage.value = DEFAULT_PAGE
  }

  return {
    data: computed(() => query.data.value?.data ?? []),
    total: computed(() => query.data.value?.total ?? 0),
    currentPage,
    pageSize,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    setCurrentPage,
    setPageSize,
    refetch: () => query.refetch(),
    query,
  }
}
