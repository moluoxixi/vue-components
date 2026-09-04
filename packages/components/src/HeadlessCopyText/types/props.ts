export interface HeadlessCopyTextProps {
  /** Plain text written to the clipboard. */
  text: string
  /** Prevent copy commands while preserving the slot state. */
  disabled?: boolean
  /** Time before the copied state resets. Set to 0 to keep it until the next command. */
  resetDelay?: number
}
