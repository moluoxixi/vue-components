import type { PaginationProps } from 'element-plus'

export type ConfigTablePaginationProps = Partial<Omit<
  PaginationProps,
  'currentPage' | 'pageSize' | 'total' | 'pageCount' | 'defaultCurrentPage' | 'defaultPageSize'
>> & Record<string, any>

export interface ConfigTablePageChangeParams {
  currentPage: number
  pageSize: number
}
