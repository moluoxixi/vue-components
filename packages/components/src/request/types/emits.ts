import type { RequestOptionRecord } from './props'

export interface RequestOptionsComponentEmits<TOption extends RequestOptionRecord = RequestOptionRecord> {
  (event: 'loaded', options: TOption[]): void
  (event: 'error', error: Error): void
}
