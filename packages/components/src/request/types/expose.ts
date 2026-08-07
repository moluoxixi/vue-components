import type { UseRequestOptionsReturn } from '@moluoxixi/hooks'
import type { RequestOptionRecord } from './props'

export interface RequestOptionsComponentExpose<TOption extends RequestOptionRecord = RequestOptionRecord> {
  refetch: UseRequestOptionsReturn<TOption>['refetch']
}
