import type { Column as TableV2Column } from 'element-plus'
import type { VNodeChild } from 'vue'
import type {
  HeadlessTableCellModeActions,
  HeadlessTableColumnOrderState,
  HeadlessTableColumnVisibilityState,
  HeadlessTableMode,
  HeadlessTableRendererConfig,
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
  mode: HeadlessTableMode
  event?: MouseEvent
}

export interface ConfigTableColumnSlots {
  default?: string | ConfigTableCellRender
  edit?: string | ConfigTableCellRender
  header?: string | ConfigTableHeaderRender
}

export interface ConfigTablePaneConfig {
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

/** @deprecated Use ConfigTablePaneConfig instead. */
export type ConfigTableColumnConfig = ConfigTablePaneConfig

export interface ConfigTableColumnSettingChange {
  columnOrder: HeadlessTableColumnOrderState
  columnVisibility: HeadlessTableColumnVisibilityState
  columnWidths: ConfigTableColumnWidthState
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
  mode: HeadlessTableMode
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
  rowId?: string | number
  setRowMode: HeadlessTableCellModeActions['setRowMode']
  clearRowMode: HeadlessTableCellModeActions['clearRowMode']
  setCellMode: HeadlessTableCellModeActions['setCellMode']
  clearCellMode: HeadlessTableCellModeActions['clearCellMode']
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
