import type { TableColumnCtx, TableProps } from 'element-plus'

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
  /** 按列指定表头/单元格插槽名。 */
  slots?: {
    default?: string
    header?: string
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
  emptyText?: string
  currentRowIndex?: number
}

export interface ConfigTableEmits {
  (event: 'cellClick', params: ConfigTableCellParams): void
  (event: 'cellDblClick', params: ConfigTableCellParams): void
}

export interface ConfigTableSlotScope {
  row?: ConfigTableRow
  column: ConfigTableColumn
  rowIndex?: number
  columnIndex: number
  value?: any
}

export interface ConfigTableSlots {
  empty?: () => any
  [name: string]: ((params: ConfigTableSlotScope) => any) | undefined
}
