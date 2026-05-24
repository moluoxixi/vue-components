import type { ResolvedFormNode } from '@/types'

/** RecursiveField 只接收已解析的任意表单节点。 */
export interface RecursiveFieldProps {
  field: ResolvedFormNode
}
