import type { PopoverTableColumn, PopoverTableRow } from './props'

/**
 * PopoverTableSelect 动态插槽作用域。
 *
 * 单元格插槽会提供完整行列上下文；表头插槽只提供 column / columnIndex。
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
  /** 当前单元格值；表头插槽不提供。 */
  value?: any
}

/**
 * PopoverTableSelect 支持 default 插槽和按列声明的动态表头/单元格插槽。
 */
export interface PopoverTableSelectSlots {
  default?: () => any
  [name: string]: ((params: PopoverTableSelectSlotScope) => any) | undefined
}
