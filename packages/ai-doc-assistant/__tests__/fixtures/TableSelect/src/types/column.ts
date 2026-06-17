import type { TableRow } from './row'

/** 列定义 */
export interface TableColumn {
  /** 行字段名 */
  field: string
  /** 表头标题 */
  title?: string
  /** 单元格格式化 */
  formatter?: (row: TableRow) => string
}
