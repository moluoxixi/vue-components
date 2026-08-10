import type { ExcelCellValue, ExcelDataRow, ParseExcelOptions } from './types'
import { read, utils } from 'xlsx'
import { createHeaderFieldMap } from './columns'

/**
 * 解析工作簿为二维矩阵，供调用方自行处理复杂表头或预览场景。
 */
export function parseExcelMatrix(source: ArrayBuffer, options: Omit<ParseExcelOptions, 'columns'> = {}): ExcelCellValue[][] {
  const workbook = read(source, { type: 'array' })
  const sheetName = options.sheetName ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  return utils.sheet_to_json(worksheet, {
    defval: options.defaultCellValue ?? '',
    header: 1,
  }) as ExcelCellValue[][]
}

/**
 * 按 columns 中的表头映射把 Excel 内容解析为对象数组。
 * 未出现在 columns 中的表头不会进入结果，UI 提示由调用方自行决定。
 */
export function parseExcelRows<Row extends ExcelDataRow = ExcelDataRow>(
  source: ArrayBuffer,
  options: ParseExcelOptions,
): Row[] {
  return mapExcelMatrixToRows(parseExcelMatrix(source, options), options)
}

/**
 * 解析 Blob/File 的浏览器友好入口，不依赖 FileReader 或任何 UI 组件。
 */
export async function parseExcelBlob<Row extends ExcelDataRow = ExcelDataRow>(
  blob: Blob,
  options: ParseExcelOptions,
): Promise<Row[]> {
  return parseExcelRows<Row>(await blob.arrayBuffer(), options)
}

/**
 * 将已读取的二维矩阵映射为对象数组，适合测试或自定义读取管线复用。
 * Row 泛型仅表达调用方基于 columns 已知的静态形状；函数不做字段完整性运行时校验。
 */
export function mapExcelMatrixToRows<Row extends ExcelDataRow = ExcelDataRow>(
  matrix: readonly (readonly ExcelCellValue[])[],
  options: ParseExcelOptions,
): Row[] {
  const [headerRow, ...bodyRows] = matrix
  const headerFieldMap = createHeaderFieldMap(options.columns, options)
  const fields = headerRow.map(header => headerFieldMap.get(String(header)))

  return bodyRows.map((row) => {
    const item: ExcelDataRow = {}

    fields.forEach((field, index) => {
      if (field !== undefined) {
        item[field] = row[index]
      }
    })

    return item as Row
  })
}
