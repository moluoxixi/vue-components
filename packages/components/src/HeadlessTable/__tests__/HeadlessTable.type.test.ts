import type { HeadlessTableColumn, HeadlessTableModeApi, HeadlessTableProps } from '@moluoxixi/components'
import { defineHeadlessTableRenderer, useHeadlessTable } from '@moluoxixi/components'
import { describe, expect, it } from 'vitest'

interface TypedRow {
  id: number
  profile: { name: string }
  score: number
}

const columns = [
  { field: 'profile.name', title: '姓名' },
  { accessorKey: 'score', title: '分数' },
  { id: 'double-score', accessor: (row: TypedRow) => row.score * 2, title: '双倍分数' },
  { id: 'actions', title: '操作' },
] satisfies HeadlessTableColumn<TypedRow>[]

const props = {
  columns,
  data: [{ id: 1, profile: { name: 'Ada' }, score: 90 }],
} satisfies HeadlessTableProps<TypedRow>

// @ts-expect-error Computed or display-only columns require a stable id.
const invalidColumn: HeadlessTableColumn<TypedRow> = { accessor: row => row.score }

const scoreRenderer = defineHeadlessTableRenderer<
  TypedRow,
  { tone: 'success' | 'warning' },
  { prefix: string }
>({
  renderDefault(renderOptions, { row, rawValue }) {
    const tone: 'success' | 'warning' | undefined = renderOptions.props?.tone
    const prefix: string = renderOptions.options?.prefix ?? ''
    return `${prefix}:${tone}:${row.id}:${rawValue}`
  },
})

const table = useHeadlessTable({
  columns,
  data: props.data,
  getRowId: row => row.id,
})
const inferredRow: TypedRow | undefined = table.rows.value[0]

function verifyModeSelectorTypes(
  api: HeadlessTableModeApi<TypedRow, HeadlessTableColumn<TypedRow>>,
): void {
  api.setRowMode(({ row, rowId, rowIndex }) => {
    const typedRow: TypedRow = row
    const typedRowId: string | number = rowId
    const typedRowIndex: number = rowIndex
    return typedRow.score > 0 && typedRowId === typedRow.id && typedRowIndex >= 0
  }, 'edit')
  api.setCellMode(({ row, column, rowId, columnId, rowIndex, columnIndex }) => {
    const typedRow: TypedRow = row
    const typedColumn: HeadlessTableColumn<TypedRow> = column
    const typedRowId: string | number = rowId
    const typedColumnId: string = columnId
    const typedRowIndex: number = rowIndex
    const typedColumnIndex: number = columnIndex
    return Boolean(
      typedRow.score
      && typedColumn
      && typedRowId
      && typedColumnId
      && typedRowIndex >= 0
      && typedColumnIndex >= 0,
    )
  }, 'edit')
}

void inferredRow
void invalidColumn
void scoreRenderer
void verifyModeSelectorTypes

describe('headless table public types', () => {
  it('保留 column、renderer 和 composable 的行类型', () => {
    expect(columns).toHaveLength(4)
    expect(table.rows.value[0].profile.name).toBe('Ada')
  })
})
