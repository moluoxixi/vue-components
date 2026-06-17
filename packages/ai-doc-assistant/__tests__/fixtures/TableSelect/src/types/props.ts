import type { TableColumn } from './column'

/** 表格选择器属性 */
export interface TableSelectProps {
  /** 列配置 */
  columns: TableColumn[]
  /** 占位符 */
  placeholder?: string
}
