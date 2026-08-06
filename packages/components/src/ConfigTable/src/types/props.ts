import type { QueryKeyBase, RequestTableQuery } from '@moluoxixi/hooks'
import type { TableV2Props } from 'element-plus'
import type {
  HeadlessTableColumnOrderState,
  HeadlessTableColumnVisibilityState,
  HeadlessTableRendererMap,
  HeadlessTableRendererRegistry,
} from '../../../HeadlessTable/src/types'
import type { ConfigTablePaginationProps } from './pagination'
import type {
  ConfigTableColumn,
  ConfigTableColumnConfig,
  ConfigTableColumnWidthState,
  ConfigTableRenderSlots,
  ConfigTableRow,
  ConfigTableRowClass,
} from './table'

export interface ConfigTableProps {
  columns?: ConfigTableColumn[]
  data?: ConfigTableRow[]
  tableProps?: Partial<TableV2Props> & {
    rowClassName?: ConfigTableRowClass
  }
  /** 表格级插槽渲染函数配置。 */
  slots?: ConfigTableRenderSlots
  /** 输出无效 slot/renderer 配置的开发期警告。 */
  diagnostics?: boolean
  /** 当前表格局部 renderer，优先于 registry。 */
  renderers?: HeadlessTableRendererMap<ConfigTableRow>
  /** 当前表格使用的 renderer registry。 */
  rendererRegistry?: HeadlessTableRendererRegistry
  /** 受控或初始列顺序，未列出的列按源顺序追加。 */
  columnOrder?: HeadlessTableColumnOrderState
  /** 受控或初始列显隐状态，优先于 column.visible。 */
  columnVisibility?: HeadlessTableColumnVisibilityState
  /** 受控列宽，按 column.id 或 field 映射到像素值。 */
  columnWidths?: ConfigTableColumnWidthState
  /** 是否显示内置列设置，也可传入弹窗配置。 */
  columnConfig?: boolean | ConfigTableColumnConfig
  emptyText?: string
  currentRowIndex?: number
  query?: RequestTableQuery<ConfigTableRow>
  params?: Record<string, unknown>
  cacheKey?: QueryKeyBase
  enabled?: boolean
  staleTime?: number
  pagination?: boolean | ConfigTablePaginationProps
  /** 非请求模式下的分页总数，默认为 data.length。 */
  total?: number
  resetPageOnParamsChange?: boolean
  currentPage?: number
  pageSize?: number
  width?: number
  height?: number
  rowHeight?: number
  headerHeight?: number
  defaultColumnWidth?: number
  /** 列设置允许的最小宽度，未设置时不限制源列宽。 */
  minColumnWidth?: number
  /** 列设置允许的最大宽度，未设置时不限制源列宽。 */
  maxColumnWidth?: number
  /** 列设置输入框的步进值。 */
  columnWidthStep?: number
  rowKey?: string
}
