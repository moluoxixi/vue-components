import type { HeadlessCopyTextProps } from '../../HeadlessCopyText'

export interface CopyTextProps extends HeadlessCopyTextProps {
  /** Accessible label and tooltip shown before a successful copy. */
  copyLabel?: string
  /** Accessible label and tooltip shown after a successful copy. */
  copiedLabel?: string
}
