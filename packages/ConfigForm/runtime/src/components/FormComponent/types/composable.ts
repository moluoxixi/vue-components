import type { ComputedRef } from 'vue'
import type { FieldComponentListeners } from '../../../types'

export interface UseFormComponentResult {
  componentAttrs: ComputedRef<Record<string, unknown>>
  componentListeners: ComputedRef<FieldComponentListeners>
}
