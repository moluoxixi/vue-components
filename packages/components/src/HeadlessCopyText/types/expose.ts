export interface HeadlessCopyTextExpose {
  copy: (text?: string) => Promise<void>
  reset: () => void
}
