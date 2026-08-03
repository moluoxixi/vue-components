import type { HeadlessCopyTextDefaultScope, HeadlessCopyTextProps } from '../../HeadlessCopyText'

export interface CopyTextProps extends HeadlessCopyTextProps {
  /** Accessible label and tooltip shown before a successful copy. */
  copyLabel?: string
  /** Accessible label and tooltip shown after a successful copy. */
  copiedLabel?: string
}

export interface CopyTextEmits {
  (event: 'copy', text: string): void
  (event: 'error', error: Error): void
}

export interface CopyTextSlots {
  default?: (scope: Pick<HeadlessCopyTextDefaultScope, 'text'>) => any
  icon?: (scope: HeadlessCopyTextDefaultScope) => any
}

export interface CopyTextExpose {
  copy: (text?: string) => Promise<void>
  reset: () => void
}
