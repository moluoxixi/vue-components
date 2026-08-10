import type {
  ExcelCellValue,
  ExcelDataRow,
  ExcelExportType,
  ExcelSpanMethod,
  ExcelSpanResult,
  ExcelWorkbookResult,
  ExportExcelOptions,
  ResolvedExcelColumn,
} from './types'
import { utils, write } from 'xlsx'
import { resolveExcelColumns } from './columns'
import { createExcelMatrix, formatExcelRows } from './format'

const EXCEL_MIME_TYPES = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} satisfies Record<ExcelExportType, string>

/**
 * 根据列配置与数据创建工作簿，调用方可继续追加工作表或自行写文件。
 */
export function createExcelWorkbook<Row extends ExcelDataRow>(
  options: ExportExcelOptions<Row>,
): ExcelWorkbookResult {
  const sheetName = options.sheetName ?? 'Sheet1'
  const worksheet = createExcelWorksheet(options)
  const workbook = utils.book_new()

  utils.book_append_sheet(workbook, worksheet, sheetName)

  return { sheetName, workbook, worksheet }
}

/**
 * 创建单个工作表，保留列宽与合并单元格元数据。
 */
export function createExcelWorksheet<Row extends ExcelDataRow>(
  options: ExportExcelOptions<Row>,
): ExcelWorkbookResult['worksheet'] {
  const columns = resolveExcelColumns(options.columns, options)
  const matrix = createExcelMatrix(options.tableData, columns)
  const worksheet = utils.aoa_to_sheet(matrix)

  if (options.autoWidth ?? true) {
    worksheet['!cols'] = calculateColumnsWidth(matrix)
  }

  const merges = createSheetMerges(formatExcelRows(options.tableData, columns), columns, options.spanMethod)
  if (merges.length > 0) {
    worksheet['!merges'] = merges
  }

  return worksheet
}

/**
 * 直接输出 Excel/CSV 二进制内容，下载、上传或持久化由调用方控制。
 */
export function writeExcelBuffer<Row extends ExcelDataRow>(
  options: ExportExcelOptions<Row>,
): ArrayBuffer {
  const { workbook } = createExcelWorkbook(options)
  const bookType = options.exportType ?? 'xlsx'

  return write(workbook, {
    bookType,
    type: 'array',
  }) as ArrayBuffer
}

/**
 * 浏览器场景下的 Blob 工厂，不绑定 file-saver 或组件事件。
 */
export function createExcelBlob<Row extends ExcelDataRow>(
  options: ExportExcelOptions<Row>,
): Blob {
  return new Blob([writeExcelBuffer(options)], {
    type: EXCEL_MIME_TYPES[options.exportType ?? 'xlsx'],
  })
}

function calculateColumnsWidth(matrix: readonly (readonly ExcelCellValue[])[]): { wch: number }[] {
  const widths: { wch: number }[] = []

  matrix.forEach((row) => {
    row.forEach((cellValue, columnIndex) => {
      const width = calculateCellWidth(cellValue)
      const current = widths[columnIndex]

      if (current === undefined || current.wch < width) {
        widths[columnIndex] = { wch: width }
      }
    })
  })

  return widths
}

function calculateCellWidth(cellValue: ExcelCellValue): number {
  const text = `${cellValue ?? ''}`
  let width = 0

  for (const char of text) {
    width += char.codePointAt(0)! > 255 ? 2.2 : 1
  }

  return Math.max(width + 4, 10)
}

function createSheetMerges<Row extends ExcelDataRow>(
  rows: readonly Record<string, ExcelCellValue>[],
  columns: readonly ResolvedExcelColumn<Row>[],
  spanMethod: ExcelSpanMethod<Row> | undefined,
): NonNullable<ExcelWorkbookResult['worksheet']['!merges']> {
  const merges: NonNullable<ExcelWorkbookResult['worksheet']['!merges']> = []

  if (spanMethod === undefined) {
    return merges
  }

  rows.forEach((row, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const span = spanMethod({
        column,
        columnIndex,
        row,
        rowIndex,
      })

      if (span === undefined) {
        return
      }

      const [rowspan, colspan] = toSpanTuple(span)
      if (rowspan === 0 || colspan === 0) {
        return
      }

      if (rowspan > 1 || colspan > 1) {
        merges.push({
          e: { c: columnIndex + colspan - 1, r: rowIndex + rowspan },
          s: { c: columnIndex, r: rowIndex + 1 },
        })
      }
    })
  })

  return merges
}

function toSpanTuple(span: Exclude<ExcelSpanResult, void>): readonly [number, number] {
  return Array.isArray(span) ? span : [span.rowspan, span.colspan]
}
