import type { ResolvedBoundNode } from '@/types'

/** FormComponent 只接收已解析的无 label 字段节点。 */
export interface FormComponentProps {
  field: ResolvedBoundNode
}
