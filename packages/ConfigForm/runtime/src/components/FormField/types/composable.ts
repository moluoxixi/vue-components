import type { ComputedRef } from 'vue'

export interface UseFormFieldResult {
  formItemComponentProps: ComputedRef<{
    field: string
    id?: string
    label: string
    required: boolean
    span: number
  }>
}
