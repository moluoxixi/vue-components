import type {
  HeadlessTableColumn,
  HeadlessTableColumnOrderState,
  HeadlessTableColumnVisibilityState,
  HeadlessTableRow,
} from './types'

export interface HeadlessTableProjectedColumn<TRow extends HeadlessTableRow = HeadlessTableRow> {
  column: HeadlessTableColumn<TRow>
  columnId: string
  sourceIndex: number
}

export interface HeadlessTableColumnProjection<TRow extends HeadlessTableRow = HeadlessTableRow> {
  allColumns: HeadlessTableProjectedColumn<TRow>[]
  columns: HeadlessTableProjectedColumn<TRow>[]
}

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

export function projectHeadlessTableColumns<TRow extends HeadlessTableRow>(
  columns: readonly HeadlessTableColumn<TRow>[],
  columnOrder: HeadlessTableColumnOrderState = [],
  columnVisibility: HeadlessTableColumnVisibilityState = {},
): HeadlessTableColumnProjection<TRow> {
  const order = new Map(columnOrder.map((id, index) => [id, index]))
  const allColumns = columns
    .map((column, sourceIndex) => ({
      column,
      columnId: getHeadlessTableColumnId(column, sourceIndex),
      sourceIndex,
    }))
    .sort((left, right) => {
      const leftOrder = order.get(left.columnId)
      const rightOrder = order.get(right.columnId)
      if (leftOrder == null && rightOrder == null)
        return left.sourceIndex - right.sourceIndex
      if (leftOrder == null)
        return 1
      if (rightOrder == null)
        return -1
      return leftOrder - rightOrder
    })

  return {
    allColumns,
    columns: allColumns.filter(({ column, columnId }) => (
      Object.hasOwn(columnVisibility, columnId)
        ? columnVisibility[columnId] !== false
        : column.visible !== false
    )),
  }
}
