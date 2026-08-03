export interface HeadlessCopyTextProps {
  /** Plain text written to the clipboard. */
  text: string
  /** Prevent copy commands while preserving the slot state. */
  disabled?: boolean
  /** Time before the copied state resets. Set to 0 to keep it until the next command. */
  resetDelay?: number
}

export interface HeadlessCopyTextEmits {
  (event: 'copy', text: string): void
  (event: 'error', error: Error): void
}

export interface HeadlessCopyTextDefaultScope {
  text: string
  disabled: boolean
  copied: boolean
  copying: boolean
  error: Error | null
  copy: (text?: string) => Promise<void>
  reset: () => void
}

export interface HeadlessCopyTextSlots {
  default?: (scope: HeadlessCopyTextDefaultScope) => any
}

export interface HeadlessCopyTextExpose {
  copy: (text?: string) => Promise<void>
  reset: () => void
}
