import type { ResolvedFormNode } from '../../../types'

export interface NodeTopology {
  nodes: WeakSet<ResolvedFormNode>
  parentMap: WeakMap<ResolvedFormNode, ResolvedFormNode | undefined>
  fieldNodeMap: Map<string, ResolvedFormNode>
}

export interface VisibilitySnapshot {
  byField: Map<string, boolean>
  byNode: WeakMap<ResolvedFormNode, boolean>
}
