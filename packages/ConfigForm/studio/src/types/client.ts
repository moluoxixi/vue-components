import type { ProjectRepository } from '@moluoxixi/config-form-model'

export type RepositoryMethod = Exclude<keyof ProjectRepository, 'close' | 'persistence'>

export interface WorkspaceChange {
  kind: 'project' | 'delete' | 'reset'
  projectId?: string
  repositoryRevision?: number
  clientId?: string
}

export interface HttpProjectRepository extends ProjectRepository {
  readonly workspaceName: string
  readonly workspaceId: string
  subscribeChanges: (listener: (change: WorkspaceChange) => void) => () => void
  subscribeConnection: (listener: (connected: boolean) => void) => () => void
}
