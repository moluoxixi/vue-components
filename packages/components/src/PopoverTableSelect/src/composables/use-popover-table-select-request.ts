import type { Ref } from 'vue'
import type {
  PopoverTablePaginationProps,
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectRuntimeProps,
} from '../types'
import { useRequestTable } from '@moluoxixi/hooks'
import { computed, watch } from 'vue'

interface PopoverTableSelectPaginationModels {
  currentPage: Ref<number>
  pageSize: Ref<number>
}

export function usePopoverTableSelectRequest(
  props: Readonly<PopoverTableSelectRuntimeProps>,
  emit: PopoverTableSelectEmits,
  models: PopoverTableSelectPaginationModels,
) {
  const requestTable = props.query
    ? useRequestTable<PopoverTableRow>({
        queryKey: props.cacheKey ?? 'PopoverTableSelect',
        query: props.query,
        params: computed(() => props.params ?? {}),
        currentPage: models.currentPage,
        pageSize: models.pageSize,
        enabled: computed(() => props.enabled ?? true),
        staleTime: props.staleTime,
        resetPageOnParamsChange: props.resetPageOnParamsChange,
      })
    : null

  const tableData = computed<PopoverTableRow[]>(() => {
    return requestTable?.data.value ?? props.data ?? []
  })

  const computedLoading = computed<boolean>(() => {
    return Boolean(props.loading || (requestTable && (requestTable.isLoading.value || requestTable.isFetching.value)))
  })

  const requestTotal = computed<number>(() => requestTable?.total.value ?? tableData.value.length)

  const shouldShowPagination = computed<boolean>(() => {
    return props.pagination !== false && Boolean(requestTable)
  })

  const paginationProps = computed<PopoverTablePaginationProps>(() => {
    const defaults: PopoverTablePaginationProps = {
      layout: 'total, sizes, prev, pager, next, jumper',
    }
    return typeof props.pagination === 'object'
      ? { ...defaults, ...props.pagination }
      : defaults
  })

  function emitPageChange(): void {
    emit('pageChange', {
      currentPage: models.currentPage.value,
      pageSize: models.pageSize.value,
    })
  }

  function handleCurrentPageUpdate(page: number): void {
    models.currentPage.value = page
    emitPageChange()
  }

  function handlePageSizeUpdate(size: number): void {
    models.pageSize.value = size
    models.currentPage.value = 1
    emitPageChange()
  }

  if (requestTable) {
    watch(
      () => requestTable.query.data.value,
      (result) => {
        if (result)
          emit('loaded', result)
      },
    )

    watch(
      () => requestTable.error.value,
      (error) => {
        if (error)
          emit('error', error)
      },
    )
  }

  return {
    computedLoading,
    handleCurrentPageUpdate,
    handlePageSizeUpdate,
    paginationProps,
    requestTotal,
    shouldShowPagination,
    tableData,
  }
}
