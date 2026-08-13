import type { Ref } from 'vue'
import type {
  ConfigTableEmits,
  ConfigTablePaginationProps,
  ConfigTableProps,
  ConfigTableRow,
} from '../types'
import { computed } from 'vue'
import { useRequestTableComponent } from '#components/request/composables'

const INTERNAL_ROW_KEY = '__mx_config_table_row_key'

export function useConfigTableData(
  props: Readonly<ConfigTableProps>,
  currentPage: Ref<number>,
  pageSize: Ref<number>,
  emit: ConfigTableEmits,
) {
  const {
    handleCurrentPageUpdate,
    handlePageSizeUpdate,
    requestLoading,
    requestTable,
    tableData,
  } = useRequestTableComponent<ConfigTableRow>({
    fallbackCacheKey: 'ConfigTable',
    models: { currentPage, pageSize },
    onError: error => emit('error', error),
    onLoaded: result => emit('loaded', result),
    onPageChange: params => emit('pageChange', params),
    props,
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
    if (requestLoading.value)
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
