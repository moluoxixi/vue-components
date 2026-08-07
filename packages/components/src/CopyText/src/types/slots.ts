import type { HeadlessCopyTextDefaultScope } from '../../../HeadlessCopyText'

export interface CopyTextSlots {
  default?: (scope: Pick<HeadlessCopyTextDefaultScope, 'text'>) => any
  icon?: (scope: HeadlessCopyTextDefaultScope) => any
}
