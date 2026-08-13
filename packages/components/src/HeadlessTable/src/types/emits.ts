import type { HeadlessTableModeChange } from './mode'

export interface HeadlessTableEmits {
  (event: 'modeChange', change: HeadlessTableModeChange): void
}
