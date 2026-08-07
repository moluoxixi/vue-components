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
