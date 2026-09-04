export interface HeadlessCopyTextEmits {
  (event: 'copy', text: string): void
  (event: 'error', error: Error): void
}
