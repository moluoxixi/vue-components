import type { ExcelCellValue, ExcelDataRow, ResolvedExcelColumn } from './types'
import { readValueByPath } from '@moluoxixi/utils'

/**
 * 按列契约把业务行转换为 Excel 行对象。
 * formatter 是显式列契约；未声明 formatter 时按 field 路径读取原始数据。
 */
export function formatExcelRows<Row extends ExcelDataRow>(
  rows: readonly Row[],
  columns: readonly ResolvedExcelColumn<Row>[],
): Record<string, ExcelCellValue>[] {
  return rows.map((row, rowIndex) => {
    const formattedRow: Record<string, ExcelCellValue> = {}

    columns.forEach((column) => {
      formattedRow[column.field] = column.source.formatter
        ? column.source.formatter(row, column.source, rowIndex)
        : readValueByPath(row, column.field) as ExcelCellValue
    })

    return formattedRow
  })
}

/**
 * 将表头和业务数据组织为 xlsx 可消费的二维矩阵。
 * 第一行固定为表头，后续行严格按 columns 顺序输出。
 */
export function createExcelMatrix<Row extends ExcelDataRow>(
  rows: readonly Row[],
  columns: readonly ResolvedExcelColumn<Row>[],
): ExcelCellValue[][] {
  const headerRow = columns.map(column => column.title)
  const formattedRows = formatExcelRows(rows, columns)
  const bodyRows = formattedRows.map(row => columns.map(column => row[column.field]))

  return [headerRow, ...bodyRows]
}
