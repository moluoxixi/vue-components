import type { Ref } from 'vue'
import type {
  PopoverTablePaginationProps,
  PopoverTableRow,
  PopoverTableSelectEmits,
  PopoverTableSelectRuntimeProps,
} from '../types'
import { computed } from 'vue'
import { useRequestTableComponent } from '../../../request/composables'

interface PopoverTableSelectPaginationModels {
  currentPage: Ref<number>
  pageSize: Ref<number>
}

export function usePopoverTableSelectRequest(
  props: Readonly<PopoverTableSelectRuntimeProps>,
  emit: PopoverTableSelectEmits,
  models: PopoverTableSelectPaginationModels,
) {
  const {
    handleCurrentPageUpdate,
    handlePageSizeUpdate,
    requestLoading,
    requestTable,
    tableData,
  } = useRequestTableComponent<PopoverTableRow>({
    fallbackCacheKey: 'PopoverTableSelect',
    models,
    onError: error => emit('error', error),
    onLoaded: result => emit('loaded', result),
    onPageChange: params => emit('pageChange', params),
    props,
  })

  const computedLoading = computed<boolean>(() => {
    return Boolean(props.loading || requestLoading.value)
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
