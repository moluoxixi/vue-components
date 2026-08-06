import type { VNodeChild } from 'vue'
import type {
  ConfigTableEmptyScope,
  ConfigTableSlotScope,
} from './table'

export interface ConfigTableSlots {
  empty?: (scope: ConfigTableEmptyScope) => VNodeChild
  [name: string]:
    | ((params: ConfigTableSlotScope) => VNodeChild)
    | ((scope: ConfigTableEmptyScope) => VNodeChild)
    | undefined
}
