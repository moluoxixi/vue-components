import type { QueryKeyBase, RequestTableQuery, RequestTableResult } from '@moluoxixi/hooks'
import type { TableColumnCtx, TableProps } from 'element-plus'
import type { VNodeChild } from 'vue'

export type ConfigTableRow = Record<string, any>

export interface ConfigTableColumn {
  /** 行字段名。 */
  field: string
  /** 表头标题，兼容旧列配置 title。 */
  title?: string
  /** 表头标题，兼容 Element Plus label。 */
  label?: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** 按列指定表头/单元格插槽名，或直接提供渲染函数。 */
  slots?: {
    default?: string | ConfigTableCellRender
    header?: string | ConfigTableHeaderRender
  }
  /** 透传给 el-table-column 的额外配置。 */
  columnProps?: Partial<TableColumnCtx<ConfigTableRow>>
  /** 单元格格式化函数。 */
  formatter?: (params: ConfigTableCellParams) => any
}

export interface ConfigTableCellParams {
  row: ConfigTableRow
  column: ConfigTableColumn
  rowIndex: number
  columnIndex: number
  value: any
  event?: MouseEvent
}

export interface ConfigTableProps {
  columns?: ConfigTableColumn[]
  data?: ConfigTableRow[]
  tableProps?: Partial<TableProps<ConfigTableRow>>
  /** 表格级插槽渲染函数配置。 */
  slots?: ConfigTableRenderSlots
  emptyText?: string
  currentRowIndex?: number
  query?: RequestTableQuery<ConfigTableRow>
  params?: Record<string, unknown>
  cacheKey?: QueryKeyBase
  enabled?: boolean
  staleTime?: number
  pagination?: boolean | ConfigTablePaginationProps
  resetPageOnParamsChange?: boolean
  currentPage?: number
  pageSize?: number
}

export interface ConfigTableEmits {
  (event: 'cellClick', params: ConfigTableCellParams): void
  (event: 'cellDblClick', params: ConfigTableCellParams): void
  (event: 'loaded', result: RequestTableResult<ConfigTableRow>): void
  (event: 'error', error: Error): void
  (event: 'pageChange', params: ConfigTablePageChangeParams): void
}

export interface ConfigTablePaginationProps {
  layout?: string
  pageSizes?: number[]
  background?: boolean
  small?: boolean
  hideOnSinglePage?: boolean
  [key: string]: any
}

export interface ConfigTablePageChangeParams {
  currentPage: number
  pageSize: number
}

export interface ConfigTableBaseScope {
  columns: ConfigTableColumn[]
  data: ConfigTableRow[]
  index?: number
}

export interface ConfigTableHeaderScope extends ConfigTableBaseScope {
  column: ConfigTableColumn
  columnIndex: number
}

export interface ConfigTableCellScope extends ConfigTableBaseScope {
  row: ConfigTableRow
  column: ConfigTableColumn
  rowIndex: number
  columnIndex: number
  value: any
}

export interface ConfigTableEmptyScope {
  columns: ConfigTableColumn[]
  data: ConfigTableRow[]
}

export type ConfigTableHeaderRender = (params: ConfigTableHeaderScope) => VNodeChild
export type ConfigTableCellRender = (params: ConfigTableCellScope) => VNodeChild
export type ConfigTableEmptyRender = (params: ConfigTableEmptyScope) => VNodeChild
export type ConfigTableRender = ConfigTableHeaderRender | ConfigTableCellRender
export type ConfigTableSlotScope = ConfigTableHeaderScope | ConfigTableCellScope

export interface ConfigTableRenderSlots {
  empty?: ConfigTableEmptyRender
}

export interface ConfigTableSlots {
  empty?: () => any
  [name: string]: ((params: ConfigTableSlotScope) => any) | undefined
}
