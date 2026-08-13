import type {
  QueryKeyBase,
  RequestTableQuery,
  RequestTableResult,
} from '@moluoxixi/hooks'
import type { Ref } from 'vue'
import { useRequestTable } from '@moluoxixi/hooks'
import { computed, watch } from 'vue'

export interface RequestTableComponentProps<TRow extends Record<string, any>> {
  data?: TRow[]
  query?: RequestTableQuery<TRow>
  params?: Record<string, unknown>
  cacheKey?: QueryKeyBase
  enabled?: boolean
  staleTime?: number
  resetPageOnParamsChange?: boolean
}

export interface RequestTableComponentModels {
  currentPage: Ref<number>
  pageSize: Ref<number>
}

export interface UseRequestTableComponentOptions<TRow extends Record<string, any>> {
  props: Readonly<RequestTableComponentProps<TRow>>
  models: RequestTableComponentModels
  fallbackCacheKey: string
  onLoaded: (result: RequestTableResult<TRow>) => void
  onError: (error: Error) => void
  onPageChange: (params: { currentPage: number, pageSize: number }) => void
}

/** Bridges the shared request-table hook to component events and pagination models. */
export function useRequestTableComponent<TRow extends Record<string, any>>(
  options: UseRequestTableComponentOptions<TRow>,
) {
  const { fallbackCacheKey, models, props } = options
  const requestTable = props.query
    ? useRequestTable<TRow>({
        queryKey: props.cacheKey ?? fallbackCacheKey,
        query: props.query,
        params: computed(() => props.params ?? {}),
        currentPage: models.currentPage,
        pageSize: models.pageSize,
        enabled: computed(() => props.enabled ?? true),
        staleTime: props.staleTime,
        resetPageOnParamsChange: props.resetPageOnParamsChange ?? true,
      })
    : null

  const tableData = computed<TRow[]>(() => requestTable?.data.value ?? props.data ?? [])
  const requestLoading = computed(() => Boolean(
    requestTable && (requestTable.isLoading.value || requestTable.isFetching.value),
  ))

  if (requestTable) {
    watch(
      () => requestTable.query.data.value,
      (result) => {
        if (result)
          options.onLoaded(result)
      },
    )
    watch(
      () => requestTable.error.value,
      (error) => {
        if (error)
          options.onError(error)
      },
    )
  }

  function emitPageChange(): void {
    options.onPageChange({
      currentPage: models.currentPage.value,
      pageSize: models.pageSize.value,
    })
  }

  function handleCurrentPageUpdate(page: number): void {
    if (requestTable)
      requestTable.setCurrentPage(page)
    else
      models.currentPage.value = page
    emitPageChange()
  }

  function handlePageSizeUpdate(size: number): void {
    if (requestTable) {
      requestTable.setPageSize(size)
    }
    else {
      models.pageSize.value = size
      models.currentPage.value = 1
    }
    emitPageChange()
  }

  return {
    handleCurrentPageUpdate,
    handlePageSizeUpdate,
    requestLoading,
    requestTable,
    tableData,
  }
}
