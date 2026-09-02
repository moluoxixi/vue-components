import type { ProjectPath, WorkspaceFile } from '../../types'

export interface WorkspaceArchiveInput {
  files: Readonly<Record<ProjectPath, Readonly<WorkspaceFile>>>
  name: string
}
