import type { FieldNode, NodeId, SurfaceValueSchema } from './contracts'

export interface SurfaceValueScopeIssue {
  message: string
  path: Array<string | number>
}

export interface SurfaceValueScopeAnalysis extends SurfaceValueSchema {
  fieldsByScope: ReadonlyMap<NodeId | undefined, ReadonlyMap<string, FieldNode>>
  issues: SurfaceValueScopeIssue[]
  ownerScopeByNodeId: ReadonlyMap<NodeId, NodeId | undefined>
  parentScopeByScopeId: ReadonlyMap<NodeId, NodeId | undefined>
}
