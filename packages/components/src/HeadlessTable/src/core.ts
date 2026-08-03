import type { HeadlessTableColumn, HeadlessTableRow } from './types'

function getFieldValue(row: HeadlessTableRow, field?: string): any {
  if (!field)
    return undefined

  if (Object.hasOwn(row, field))
    return row[field]

  return field.split('.').reduce<any>((value, key) => value?.[key], row)
}

export function getHeadlessTableColumnId<TRow extends HeadlessTableRow>(
  column: HeadlessTableColumn<TRow>,
  columnIndex?: number,
): string {
  return column.id
    ?? column.field
    ?? column.accessorKey
    ?? `column-${columnIndex ?? 0}`
}

export function getHeadlessTableColumnLabel<TRow extends HeadlessTableRow>(
  column: HeadlessTableColumn<TRow>,
  columnIndex?: number,
): string {
  return column.label
    ?? column.title
    ?? column.accessorKey
    ?? column.field
    ?? getHeadlessTableColumnId(column, columnIndex)
}

export function getHeadlessTableRawValue<TRow extends HeadlessTableRow>(
  row: TRow,
  column: HeadlessTableColumn<TRow>,
  _rowIndex: number,
): any {
  if (column.accessor)
    return column.accessor(row)

  return getFieldValue(row, column.accessorKey ?? column.field)
}
