import type { ComputedRef, CSSProperties } from 'vue'
import type { FormContext } from '../../../types'

export interface UseFormLayoutResult {
  layoutCtx: FormContext
  layoutStyle: ComputedRef<CSSProperties>
}
