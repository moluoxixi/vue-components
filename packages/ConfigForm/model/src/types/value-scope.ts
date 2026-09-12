import type { FieldNode, NodeId, ProjectPageValueSchema } from './contracts'

export interface ProjectPageValueScopeIssue {
  message: string
  path: Array<string | number>
}

export interface ProjectPageValueScopeAnalysis extends ProjectPageValueSchema {
  fieldsByScope: ReadonlyMap<NodeId | undefined, ReadonlyMap<string, FieldNode>>
  issues: ProjectPageValueScopeIssue[]
  ownerScopeByNodeId: ReadonlyMap<NodeId, NodeId | undefined>
  parentScopeByScopeId: ReadonlyMap<NodeId, NodeId | undefined>
}
