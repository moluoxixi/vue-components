export interface CopyTextExpose {
  copy: (text?: string) => Promise<void>
  reset: () => void
}
