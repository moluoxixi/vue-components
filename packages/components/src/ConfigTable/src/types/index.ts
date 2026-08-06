import type { QueryKeyBase, RequestTableQuery, RequestTableResult } from '@moluoxixi/hooks'
import type { PaginationProps, Column as TableV2Column, TableV2Props } from 'element-plus'
import type { VNodeChild } from 'vue'
import type {
  HeadlessTableColumnOrderState,
  HeadlessTableColumnVisibilityState,
  HeadlessTableRendererConfig,
  HeadlessTableRendererMap,
  HeadlessTableRendererRegistry,
} from '../../../HeadlessTable/src/types'

export type ConfigTableRow = Record<string, any>
export type ConfigTableColumnWidthState = Record<string, number>

export interface ConfigTableColumn {
  /** 稳定列标识，用于列排序与显示隐藏；默认使用 field。 */
  id?: string
  /** 行字段名。 */
  field: string
  /** 表头标题，兼容旧列配置 title。 */
  title?: string
  /** 表头标题，兼容 Element Plus label。 */
  label?: string
  width?: number | string
  minWidth?: number | string
  align?: 'left' | 'center' | 'right'
  /** 初始是否显示；columnVisibility 中的同名配置优先。 */
  visible?: boolean
  /** 按列指定表头/单元格插槽名，或直接提供渲染函数。 */
  slots?: ConfigTableColumnSlots
  /** VXE Table 风格的命名单元格 renderer 配置。 */
  cellRender?: HeadlessTableRendererConfig
  /** VXE Table 风格的命名表头 renderer 配置。 */
  headerRender?: HeadlessTableRendererConfig
  /** 透传给 TableV2 column 的额外配置。 */
  columnProps?: Partial<TableV2Column<ConfigTableRow>> & {
    className?: string
  }
  /** 单元格格式化函数。 */
  formatter?: (params: ConfigTableCellParams) => any
}

export interface ConfigTableCellParams {
  row: ConfigTableRow
  column: ConfigTableColumn
  rowIndex: number
  columnIndex: number
  /** 源 columns 数组中的索引，与 columnIndex 相同。 */
  sourceColumnIndex: number
  /** 当前可见列中的索引。 */
  visibleColumnIndex: number
  value: any
  rawValue: any
  event?: MouseEvent
}

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

export interface ConfigTableColumnSlots {
  default?: string | ConfigTableCellRender
  header?: string | ConfigTableHeaderRender
}

export interface ConfigTableEmits {
  (event: 'cellClick', params: ConfigTableCellParams): void
  (event: 'cellDblClick', params: ConfigTableCellParams): void
  (event: 'loaded', result: RequestTableResult<ConfigTableRow>): void
  (event: 'error', error: Error): void
  (event: 'pageChange', params: ConfigTablePageChangeParams): void
  (event: 'update:columnOrder', value: HeadlessTableColumnOrderState): void
  (event: 'update:columnVisibility', value: HeadlessTableColumnVisibilityState): void
  (event: 'update:columnWidths', value: ConfigTableColumnWidthState): void
  (event: 'columnSettingChange', value: ConfigTableColumnSettingChange): void
}

export interface ConfigTableColumnConfig {
  /** 工具栏按钮文本。 */
  buttonText?: string
  /** 弹窗标题。 */
  title?: string
  /** 弹窗宽度。 */
  width?: number | string
  /** 是否启用拖拽，默认启用。 */
  draggable?: boolean
  /** 输入框允许的最小宽度。 */
  minColumnWidth?: number
  /** 输入框允许的最大宽度。 */
  maxColumnWidth?: number
  /** 输入框步进值。 */
  columnWidthStep?: number
}

export interface ConfigTableColumnSettingChange {
  columnOrder: HeadlessTableColumnOrderState
  columnVisibility: HeadlessTableColumnVisibilityState
  columnWidths: ConfigTableColumnWidthState
}

export type ConfigTablePaginationProps = Partial<Omit<
  PaginationProps,
  'currentPage' | 'pageSize' | 'total' | 'pageCount' | 'defaultCurrentPage' | 'defaultPageSize'
>> & Record<string, any>

export interface ConfigTablePageChangeParams {
  currentPage: number
  pageSize: number
}

export interface ConfigTableRowClassParams {
  columns: ConfigTableColumn[]
  rowData: ConfigTableRow
  rowIndex: number
}

export type ConfigTableRowClass = string | ((params: ConfigTableRowClassParams) => string)

export interface ConfigTableBaseScope {
  /** 原始 columns 数组，保留现有语义。 */
  columns: ConfigTableColumn[]
  /** 原始 columns 数组的显式别名。 */
  allColumns: ConfigTableColumn[]
  /** 应用排序和显隐后的列。 */
  visibleColumns: ConfigTableColumn[]
  data: ConfigTableRow[]
  index?: number
}

export interface ConfigTableHeaderScope extends ConfigTableBaseScope {
  column: ConfigTableColumn
  columnIndex: number
  sourceColumnIndex: number
  visibleColumnIndex: number
}

export interface ConfigTableCellScope extends ConfigTableBaseScope {
  row: ConfigTableRow
  column: ConfigTableColumn
  rowIndex: number
  columnIndex: number
  value: any
  rawValue: any
  sourceColumnIndex: number
  visibleColumnIndex: number
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
  empty?: (scope: ConfigTableEmptyScope) => VNodeChild
  [name: string]:
    | ((params: ConfigTableSlotScope) => VNodeChild)
    | ((scope: ConfigTableEmptyScope) => VNodeChild)
    | undefined
}
