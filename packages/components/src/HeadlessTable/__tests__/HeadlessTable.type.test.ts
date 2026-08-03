import type { HeadlessTableColumn, HeadlessTableProps } from '../../../index'
import { describe, expect, it } from 'vitest'
import { defineHeadlessTableRenderer, useHeadlessTable } from '../../../index'

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

void inferredRow
void invalidColumn
void scoreRenderer

describe('headless table public types', () => {
  it('保留 column、renderer 和 composable 的行类型', () => {
    expect(columns).toHaveLength(4)
    expect(table.rows.value[0].profile.name).toBe('Ada')
  })
})
