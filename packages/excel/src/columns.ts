import type {
  ExcelColumn,
  ExcelColumnMember,
  ExcelColumnResolveOptions,
  ExcelDataRow,
  ResolvedExcelColumn,
} from './types'

const DEFAULT_TITLE_KEYS = ['title', 'label'] as const
const DEFAULT_FIELD_KEYS = ['field', 'prop'] as const

/**
 * 将源组件的 title/label 与 field/prop 约定解析为稳定列契约。
 * 缺失列成员属于调用方契约错误，本函数会直接抛出带上下文的失败。
 */
export function resolveExcelColumns<Row extends ExcelDataRow>(
  columns: readonly ExcelColumn<Row>[],
  options: ExcelColumnResolveOptions = {},
): ResolvedExcelColumn<Row>[] {
  const titleKeys = options.titleKeys ?? DEFAULT_TITLE_KEYS
  const fieldKeys = options.fieldKeys ?? DEFAULT_FIELD_KEYS
  const resolved: ResolvedExcelColumn<Row>[] = []

  columns.forEach((column) => {
    const titles = toColumnMemberList(readColumnMember(column, titleKeys, 'title'))
    const fields = toColumnMemberList(readColumnMember(column, fieldKeys, 'field'))

    if (titles.length === fields.length) {
      titles.forEach((title, index) => {
        resolved.push({ field: fields[index], source: column, title })
      })

      return
    }

    if (fields.length === 1) {
      titles.forEach((title) => {
        resolved.push({ field: fields[0], source: column, title })
      })

      return
    }

    if (titles.length === 1) {
      resolved.push({ field: fields[0], source: column, title: titles[0] })
      return
    }

    throw new TypeError('[excel] column title and field members cannot be paired')
  })

  return resolved
}

/**
 * 构造导入时使用的表头到字段映射，保持表格列配置为唯一契约来源。
 */
export function createHeaderFieldMap(
  columns: readonly ExcelColumn[],
  options: ExcelColumnResolveOptions = {},
): Map<string, string> {
  return new Map(resolveExcelColumns(columns, options).map(column => [column.title, column.field]))
}

function readColumnMember<Row extends ExcelDataRow>(
  column: ExcelColumn<Row>,
  keys: readonly string[],
  role: 'title' | 'field',
): ExcelColumnMember {
  for (const key of keys) {
    const value = column[key] as ExcelColumnMember | undefined
    if (value !== undefined) {
      return value
    }
  }

  throw new TypeError(`[excel] column ${role} member not found by keys: ${keys.join('/')}`)
}

function toColumnMemberList(member: ExcelColumnMember): string[] {
  return [member].flat()
}
