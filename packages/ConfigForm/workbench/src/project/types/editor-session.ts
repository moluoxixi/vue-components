import type {
  ModelDiagnostic,
  PersistedProjectEnvelope,
  ProjectChangeSet,
  ProjectCommand,
  ProjectDomainEngineOptions,
  ProjectDomainSnapshot,
  ProjectRepository,
  ProjectRepositoryPersistence,
  ProjectSnapshot,
} from '@moluoxixi/config-form-model'
import type { ProjectSavedIdentity } from '../persistence'

export interface ProjectEditorSessionSnapshot extends ProjectSnapshot {
  canRedo: boolean
  canUndo: boolean
  createdAt: string
  dirty: boolean
  history: ProjectDomainSnapshot['history']
  lastError?: ModelDiagnostic
  persistence: ProjectRepositoryPersistence
  repositoryRevision: number
  saving: boolean
  updatedAt: string
}

export interface ProjectEditorSessionDispatchResult {
  changed: boolean
  changeSet: ProjectChangeSet
  diagnostics: ModelDiagnostic[]
  snapshot: ProjectEditorSessionSnapshot
}

export type ProjectEditorSessionSaveResult
  = | {
    success: true
    newerEdits: boolean
    repositoryRevision: number
    savedIdentity: ProjectSavedIdentity
    snapshot: ProjectEditorSessionSnapshot
  }
  | {
    success: false
    error: ModelDiagnostic
    snapshot: ProjectEditorSessionSnapshot
  }

export interface ProjectEditorSessionOptions extends Omit<ProjectDomainEngineOptions, 'document'> {
  createCommitId?: () => string
  project: PersistedProjectEnvelope
  repository: ProjectRepository
}

export interface OpenProjectEditorSessionOptions
  extends Omit<ProjectEditorSessionOptions, 'project'> {
  projectId: string
}

export interface ProjectEditorSession {
  readonly snapshot: ProjectEditorSessionSnapshot
  execute: (command: ProjectCommand) => ProjectEditorSessionDispatchResult
  redo: () => ProjectEditorSessionDispatchResult
  save: (options: ProjectEditorSessionSaveOptions) => Promise<ProjectEditorSessionSaveResult>
  subscribe: (
    listener: (snapshot: ProjectEditorSessionSnapshot, changeSet: ProjectChangeSet) => void,
  ) => () => void
  undo: () => ProjectEditorSessionDispatchResult
}

export interface ProjectEditorSessionSaveOptions {
  label?: string
  sealHistoryGroup: boolean
  source: 'autosave' | 'manual'
}
