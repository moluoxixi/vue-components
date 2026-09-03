import { describe, expect, it } from 'vitest'
import { read, utils, write } from 'xlsx'
import {
  createExcelBlob,
  createExcelMatrix,
  createExcelWorkbook,
  createExcelWorksheet,
  formatExcelRows,
  mapExcelMatrixToRows,
  parseExcelBlob,
  parseExcelMatrix,
  parseExcelRows,
  resolveExcelColumns,
  writeExcelBuffer,
} from '../index'

const columns = [
  { label: '姓名', prop: 'name' },
  { label: '年龄', prop: 'profile.age' },
  {
    formatter: (_row: Record<string, unknown>, _column: unknown, rowIndex: number) => rowIndex + 1,
    label: '序号',
    prop: 'index',
  },
] as const

describe('excel columns', () => {
  it('resolves title/label and field/prop column contracts', () => {
    expect(resolveExcelColumns(columns)).toEqual([
      { field: 'name', source: columns[0], title: '姓名' },
      { field: 'profile.age', source: columns[1], title: '年龄' },
      { field: 'index', source: columns[2], title: '序号' },
    ])
  })

  it('keeps legacy multiple title to one field pairing', () => {
    expect(resolveExcelColumns([{ label: ['姓名', '名称'], prop: 'name' }])).toEqual([
      { field: 'name', source: { label: ['姓名', '名称'], prop: 'name' }, title: '姓名' },
      { field: 'name', source: { label: ['姓名', '名称'], prop: 'name' }, title: '名称' },
    ])
  })

  it('uses the first field when one title maps to multiple field candidates', () => {
    const source = { label: '主字段', prop: ['primary', 'secondary'] }

    expect(resolveExcelColumns([source])).toEqual([
      { field: 'primary', source, title: '主字段' },
    ])
  })

  it('throws visible contract errors for unpairable or incomplete columns', () => {
    expect(() => resolveExcelColumns([{ label: ['姓名', '年龄'], prop: ['name', 'age', 'extra'] }]))
      .toThrow('[excel] column title and field members cannot be paired')
    expect(() => resolveExcelColumns([{ label: '姓名' }]))
      .toThrow('[excel] column field member not found by keys: field/prop')
  })
})

describe('excel export data', () => {
  it('formats nested values and column formatter values', () => {
    const resolvedColumns = resolveExcelColumns(columns)
    const rows = [{ name: '张三', profile: { age: 18 } }]

    expect(formatExcelRows(rows, resolvedColumns)).toEqual([
      {
        'profile.age': 18,
        'index': 1,
        'name': '张三',
      },
    ])
    expect(createExcelMatrix(rows, resolvedColumns)).toEqual([
      ['姓名', '年龄', '序号'],
      ['张三', 18, 1],
    ])
  })

  it('creates workbook metadata without binding download behavior', () => {
    const { sheetName, worksheet } = createExcelWorkbook({
      columns,
      sheetName: '用户',
      spanMethod: ({ columnIndex, rowIndex }) => {
        if (rowIndex === 0 && columnIndex === 0) {
          return { colspan: 1, rowspan: 2 }
        }
      },
      tableData: [
        { name: '张三', profile: { age: 18 } },
        { name: '李四', profile: { age: 20 } },
      ],
    })

    expect(sheetName).toBe('用户')
    expect(worksheet.A1?.v).toBe('姓名')
    expect(worksheet.A2?.v).toBe('张三')
    expect(worksheet.B3?.v).toBe(20)
    expect(worksheet['!cols']?.[0].wch).toBeGreaterThanOrEqual(10)
    expect(worksheet['!merges']).toEqual([{ e: { c: 0, r: 2 }, s: { c: 0, r: 1 } }])
  })

  it('writes an xlsx buffer that can be parsed by xlsx', () => {
    const buffer = writeExcelBuffer({
      columns,
      tableData: [{ name: '张三', profile: { age: 18 } }],
    })
    const workbook = read(buffer, { type: 'array' })
    const worksheet = workbook.Sheets.Sheet1

    expect(utils.sheet_to_json(worksheet, { header: 1 })).toEqual([
      ['姓名', '年龄', '序号'],
      ['张三', 18, 1],
    ])
    expect(buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('supports csv buffers, browser blobs, disabled width metadata, and array span results', async () => {
    const worksheet = createExcelWorksheet({
      autoWidth: false,
      columns,
      spanMethod: ({ columnIndex, rowIndex }) => {
        if (rowIndex === 0 && columnIndex === 0) {
          return [1, 0]
        }

        if (rowIndex === 0 && columnIndex === 1) {
          return [1, 2]
        }
      },
      tableData: [{ name: '张三', profile: { age: 18 } }],
    })
    const csvBuffer = writeExcelBuffer({
      columns: [{ label: '姓名', prop: 'name' }],
      exportType: 'csv',
      tableData: [{ name: '张三' }],
    })
    const blob = createExcelBlob({
      columns: [{ label: '姓名', prop: 'name' }],
      tableData: [{ name: '张三' }],
    })
    const csvBlob = createExcelBlob({
      columns: [{ label: '姓名', prop: 'name' }],
      exportType: 'csv',
      tableData: [{ name: '张三' }],
    })
    const parsedBlobRows = await parseExcelBlob(blob, {
      columns: [{ label: '姓名', prop: 'name' }],
    })

    expect(worksheet['!cols']).toBeUndefined()
    expect(worksheet['!merges']).toEqual([{ e: { c: 2, r: 1 }, s: { c: 1, r: 1 } }])
    expect(csvBuffer).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(csvBuffer)).toContain('姓名')
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(csvBlob.type).toBe('text/csv;charset=utf-8')
    expect(parsedBlobRows).toEqual([{ name: '张三' }])
  })

  it('calculates column width by Unicode code point instead of UTF-16 unit', () => {
    const worksheet = createExcelWorksheet({
      columns: [{ label: '表情', prop: 'emoji' }],
      tableData: [{ emoji: '\u{1F600}\u{1F600}\u{1F600}\u{1F600}' }],
    })

    expect(worksheet['!cols']?.[0].wch).toBeCloseTo(12.8)
  })
})

describe('excel import data', () => {
  it('maps matrix rows by header and ignores unknown headers', () => {
    const rows = mapExcelMatrixToRows([
      ['姓名', '年龄', '未配置列'],
      ['张三', 18, 'ignored'],
      ['李四', 20, 'ignored'],
    ], { columns })

    expect(rows).toEqual([
      { 'profile.age': 18, 'name': '张三' },
      { 'profile.age': 20, 'name': '李四' },
    ])
  })

  it('parses xlsx array buffer into mapped rows', () => {
    const buffer = writeExcelBuffer({
      columns: [
        { label: '姓名', prop: 'name' },
        { label: '年龄', prop: 'age' },
      ],
      tableData: [{ age: 18, name: '张三' }],
    })

    expect(parseExcelRows(buffer, {
      columns: [
        { label: '姓名', prop: 'name' },
        { label: '年龄', prop: 'age' },
      ],
    })).toEqual([{ age: 18, name: '张三' }])
  })

  it('parses a named sheet matrix with caller-defined empty cell value', () => {
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['姓名'], ['张三']]), '第一页')
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([['姓名', '年龄'], ['李四']]), '目标页')
    const buffer = write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

    expect(parseExcelMatrix(buffer, {
      defaultCellValue: '空值',
      sheetName: '目标页',
    })).toEqual([
      ['姓名', '年龄'],
      ['李四', '空值'],
    ])
  })
})
