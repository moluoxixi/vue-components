import type { RequestTableResult } from '@moluoxixi/hooks'
import type {
  HeadlessTableColumnOrderState,
  HeadlessTableColumnVisibilityState,
  HeadlessTableModeChange,
} from '../../../HeadlessTable'
import type { ConfigTablePageChangeParams } from './pagination'
import type {
  ConfigTableCellParams,
  ConfigTableColumnSettingChange,
  ConfigTableColumnWidthState,
  ConfigTableRow,
} from './table'

export interface ConfigTableEmits {
  (event: 'cellClick', params: ConfigTableCellParams): void
  (event: 'cellDblClick', params: ConfigTableCellParams): void
  (event: 'loaded', result: RequestTableResult<ConfigTableRow>): void
  (event: 'error', error: Error): void
  (event: 'pageChange', params: ConfigTablePageChangeParams): void
  (event: 'modeChange', change: HeadlessTableModeChange): void
  (event: 'update:columnOrder', value: HeadlessTableColumnOrderState): void
  (event: 'update:columnVisibility', value: HeadlessTableColumnVisibilityState): void
  (event: 'update:columnWidths', value: ConfigTableColumnWidthState): void
  (event: 'columnSettingChange', value: ConfigTableColumnSettingChange): void
}
