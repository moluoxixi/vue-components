import type { WorkBook, WorkSheet } from 'xlsx'

export type ExcelExportType = 'xlsx' | 'csv'

export type ExcelCellValue = string | number | boolean | Date | null | undefined

export type ExcelDataRow = Record<string, unknown>

export type ExcelColumnMember = string | readonly string[]

export type ExcelCellAlignment = 'left' | 'center' | 'right'

export interface ExcelColumn<Row extends ExcelDataRow = ExcelDataRow> extends Record<string, unknown> {
  /** 表头字段，默认按 title -> label 优先级读取。 */
  title?: ExcelColumnMember
  /** 兼容 Element Plus el-table-column 的 label 字段。 */
  label?: ExcelColumnMember
  /** 数据字段，默认按 field -> prop 优先级读取。支持 user.name 形式的路径。 */
  field?: ExcelColumnMember
  /** 兼容 Element Plus el-table-column 的 prop 字段。 */
  prop?: ExcelColumnMember
  /** 保留源组件的列对齐语义，调用方可在二次封装中使用。 */
  align?: ExcelCellAlignment
  /** 列级导出格式化函数；存在时优先于 field/prop 取值。 */
  formatter?: (row: Row, column: ExcelColumn<Row>, rowIndex: number) => ExcelCellValue
}

export interface ResolvedExcelColumn<Row extends ExcelDataRow = ExcelDataRow> {
  /** Excel 第一行展示的表头。 */
  title: string
  /** 数据行读取和导入结果写入使用的字段名。 */
  field: string
  /** 原始列配置，保留 formatter、align 等上层语义。 */
  source: ExcelColumn<Row>
}

export interface ExcelColumnResolveOptions {
  /** 从列配置中读取表头的字段优先级。 */
  titleKeys?: readonly string[]
  /** 从列配置中读取数据字段的字段优先级。 */
  fieldKeys?: readonly string[]
}

export interface ParseExcelOptions extends ExcelColumnResolveOptions {
  /** 需要解析的列配置，决定表头到字段名的映射。 */
  columns: readonly ExcelColumn[]
  /** 工作表名；不传时使用工作簿第一个工作表。 */
  sheetName?: string
  /** 空单元格在导入结果中的值，默认与原组件保持一致为空字符串。 */
  defaultCellValue?: ExcelCellValue
}

export interface ExportExcelOptions<Row extends ExcelDataRow = ExcelDataRow> extends ExcelColumnResolveOptions {
  /** 待导出的业务数据。 */
  tableData: readonly Row[]
  /** 导出列配置，兼容 title/label 与 field/prop。 */
  columns: readonly ExcelColumn<Row>[]
  /** 工作表名称。 */
  sheetName?: string
  /** 输出文件类型。 */
  exportType?: ExcelExportType
  /** 是否写入 !cols 列宽信息。 */
  autoWidth?: boolean
  /** 合并单元格计算函数；返回 0 行或 0 列表示该位置不创建合并。 */
  spanMethod?: ExcelSpanMethod<Row>
}

export interface ExcelSpanContext<Row extends ExcelDataRow = ExcelDataRow> {
  rowIndex: number
  columnIndex: number
  row: Record<string, ExcelCellValue>
  column: ResolvedExcelColumn<Row>
}

export type ExcelSpanResult = { rowspan: number, colspan: number } | [number, number] | void

export type ExcelSpanMethod<Row extends ExcelDataRow = ExcelDataRow> = (
  context: ExcelSpanContext<Row>,
) => ExcelSpanResult

export interface ExcelWorkbookResult {
  workbook: WorkBook
  worksheet: WorkSheet
  sheetName: string
}
