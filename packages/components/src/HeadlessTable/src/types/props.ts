import type { HeadlessTableMode } from './mode'
import type { HeadlessTableRendererMap, HeadlessTableRendererRegistry } from './renderer'
import type { HeadlessTableColumn, HeadlessTableEmptyRender, HeadlessTableRow, HeadlessTableRowKey } from './table'

export interface HeadlessTableProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  columns?: HeadlessTableColumn<TRow>[]
  data?: TRow[]
  /** Table-wide rendering mode. Row and cell modes are controlled through the exposed API. */
  mode?: HeadlessTableMode
  /** Stable row identity used to resolve row and cell mode overrides. */
  getRowId?: (row: TRow, rowIndex: number) => HeadlessTableRowKey
  emptyText?: string
  /** Emit development warnings for invalid renderer and slot configuration. */
  diagnostics?: boolean
  /** Per-table renderers override entries from the scoped or global registry. */
  renderers?: HeadlessTableRendererMap<TRow>
  /** Registry for this table. It overrides the injected and global registries. */
  rendererRegistry?: HeadlessTableRendererRegistry
  /** Table-level render-function configuration. */
  slots?: {
    empty?: HeadlessTableEmptyRender<TRow>
  }
}
