import type { WorkspaceProject, WorkspaceProjectDraft, WorkspaceProjectSummary } from './types'

export interface WorkspaceProjectRepository {
  readonly persistence: 'durable' | 'volatile'
  close: () => void
  commit: (id: string, baseRevision: number, next: WorkspaceProject) => Promise<WorkspaceProject>
  create: (project: WorkspaceProject) => Promise<void>
  delete: (id: string) => Promise<void>
  get: (id: string) => Promise<WorkspaceProject | undefined>
  getDraft: (id: string) => Promise<WorkspaceProjectDraft | undefined>
  list: () => Promise<WorkspaceProjectSummary[]>
  saveDraft: (id: string, draft?: WorkspaceProjectDraft) => Promise<void>
}

export interface WorkspaceProjectRepositoryOptions {
  now?: () => string
}

export const systemWorkspaceClock = (): string => new Date().toISOString()
