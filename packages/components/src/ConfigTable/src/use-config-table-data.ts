import type { Ref } from 'vue'
import type {
  ConfigTableEmits,
  ConfigTablePaginationProps,
  ConfigTableProps,
  ConfigTableRow,
} from './types'
import { useRequestTable } from '@moluoxixi/hooks'
import { computed, watch } from 'vue'

const INTERNAL_ROW_KEY = '__mx_config_table_row_key'

export function useConfigTableData(
  props: Readonly<ConfigTableProps>,
  currentPage: Ref<number>,
  pageSize: Ref<number>,
  emit: ConfigTableEmits,
) {
  const requestTable = props.query
    ? useRequestTable<ConfigTableRow>({
        queryKey: props.cacheKey ?? 'ConfigTable',
        query: props.query,
        params: computed(() => props.params ?? {}),
        currentPage,
        pageSize,
        enabled: computed(() => props.enabled ?? true),
        staleTime: props.staleTime,
        resetPageOnParamsChange: props.resetPageOnParamsChange ?? true,
      })
    : null

  const tableData = computed<ConfigTableRow[]>(() => {
    return requestTable?.data.value ?? props.data ?? []
  })

  const virtualRows = computed<ConfigTableRow[]>(() => {
    if (props.rowKey !== INTERNAL_ROW_KEY)
      return tableData.value

    return tableData.value.map((row, rowIndex) => ({
      ...row,
      [INTERNAL_ROW_KEY]: rowIndex,
    }))
  })

  const requestTotal = computed<number>(() => (
    requestTable?.total.value ?? props.total ?? tableData.value.length
  ))

  const computedEmptyText = computed<string>(() => {
    if (requestTable && (requestTable.isLoading.value || requestTable.isFetching.value))
      return '加载中...'
    if (requestTable?.isError.value)
      return '加载失败'
    return props.emptyText ?? '暂无数据'
  })

  const shouldShowPagination = computed<boolean>(() => {
    return props.pagination !== false && (Boolean(props.pagination) || Boolean(requestTable))
  })

  const paginationProps = computed<ConfigTablePaginationProps>(() => {
    const defaults: ConfigTablePaginationProps = {
      layout: 'total, sizes, prev, pager, next, jumper',
    }
    if (typeof props.pagination !== 'object')
      return defaults

    const {
      currentPage: _currentPage,
      pageSize: _pageSize,
      total: _total,
      pageCount: _pageCount,
      defaultCurrentPage: _defaultCurrentPage,
      defaultPageSize: _defaultPageSize,
      ...passthrough
    } = props.pagination

    return { ...defaults, ...passthrough }
  })

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

  function emitPageChange(): void {
    emit('pageChange', {
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    })
  }

  function handleCurrentPageUpdate(page: number): void {
    currentPage.value = page
    emitPageChange()
  }

  function handlePageSizeUpdate(size: number): void {
    pageSize.value = size
    currentPage.value = 1
    emitPageChange()
  }

  return {
    computedEmptyText,
    handleCurrentPageUpdate,
    handlePageSizeUpdate,
    paginationProps,
    requestTable,
    requestTotal,
    shouldShowPagination,
    tableData,
    virtualRows,
  }
}
