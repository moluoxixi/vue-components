import type { PopoverTableColumn, PopoverTableRow } from './props'

/**
 * PopoverTableSelect 动态插槽作用域。
 *
 * 单元格插槽会提供完整行列上下文；表头插槽不提供 row / rowIndex / value。
 */
export interface PopoverTableSelectSlotScope {
  /** 当前行数据；表头插槽不提供。 */
  row?: PopoverTableRow
  /** 当前列配置。 */
  column: PopoverTableColumn
  /** 当前行索引；表头插槽不提供。 */
  rowIndex?: number
  /** 当前列索引。 */
  columnIndex: number
  /** 通用索引：表头插槽为 columnIndex，单元格插槽为 rowIndex。 */
  index?: number
  /** 当前表格列配置列表。 */
  columns?: PopoverTableColumn[]
  /** 当前表格数据列表。 */
  data?: PopoverTableRow[]
  /** 当前单元格值；表头插槽不提供。 */
  value?: any
}

/**
 * PopoverTableSelect 支持 default 插槽和按列声明的动态表头/单元格插槽。
 */
export interface PopoverTableSelectSlots {
  default?: () => any
  footer?: () => any
  [name: string]: ((params: PopoverTableSelectSlotScope) => any) | undefined
}
