import type { ResolvedField } from '@/types'

/** FormField 只接收带 label 的真实字段节点。 */
export interface FormFieldProps {
  field: ResolvedField
}
