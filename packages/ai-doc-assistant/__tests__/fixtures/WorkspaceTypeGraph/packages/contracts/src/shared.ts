import type { CycleA } from './cycle-a'
import type { WorkspaceEnvelope, WorkspaceLeaf } from './generic'

export interface SharedWorkspaceType {
  cycle: CycleA
  data: WorkspaceEnvelope<WorkspaceLeaf>
}
