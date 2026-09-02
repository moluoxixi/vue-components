import type { ComputedRef, VNodeChild } from 'vue'

export interface UseReadonlyFieldResult {
  componentAttrs: ComputedRef<Record<string, unknown>>
  formItemComponentProps: ComputedRef<{
    field: string
    id?: string
    label: string
    required: boolean
    span: number
  }>
  hasLabel: ComputedRef<boolean>
  readonlyRenderer: ComputedRef<() => VNodeChild>
}
