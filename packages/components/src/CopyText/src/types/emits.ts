export interface CopyTextEmits {
  (event: 'copy', text: string): void
  (event: 'error', error: Error): void
}
