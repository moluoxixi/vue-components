import type { NodeId, PageId, ProjectNodeChange, ProjectOperation, SlotItem } from '../../../types'

export interface NodeLocation {
  index: number
  item: SlotItem
  parentId: NodeId | null
  sequence: SlotItem[]
  slot?: string
}

export interface OperationResult {
  changedProject: boolean
  inverse: ProjectOperation[]
  changedPageIds: PageId[]
  changedNodeIds: NodeId[]
  changedNodeChanges: ProjectNodeChange[]
}

export interface ValidationPlan {
  pageIds: Set<PageId>
  registryNodeIdsByPage: Map<PageId, Set<NodeId>>
  registryPageIds: Set<PageId>
  registryPlacementIdsByPage: Map<PageId, Set<NodeId>>
}
