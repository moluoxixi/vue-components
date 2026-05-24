import type { ResolvedBoundNode } from '@/types'

/** ReadonlyField 只接收已解析的真实字段节点。 */
export interface ReadonlyFieldProps {
  field: ResolvedBoundNode
}
