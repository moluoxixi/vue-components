import type { HeadlessTableRendererMap, HeadlessTableRendererRegistry } from './renderer'
import type { HeadlessTableColumn, HeadlessTableEmptyRender, HeadlessTableRow } from './table'

export interface HeadlessTableProps<TRow extends HeadlessTableRow = HeadlessTableRow> {
  columns?: HeadlessTableColumn<TRow>[]
  data?: TRow[]
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
