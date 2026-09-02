import type {
  ModelDiagnostic,
  ProjectCommitMetadata,
  ProjectRepository,
  ProjectRepositoryPersistence,
  ReadonlyProjectDocument,
} from '@moluoxixi/config-form-model'

export interface ProjectSaveCapture {
  cursor: string
  contentHash: string
  document: ReadonlyProjectDocument
  editVersion: number
}

export interface ProjectSavedIdentity {
  contentHash: string
  cursor: string
  editVersion: number
  repositoryRevision: number
}

export interface ProjectSaveCoordinatorSnapshot {
  createdAt: string
  lastError?: ModelDiagnostic
  persistence: ProjectRepositoryPersistence
  repositoryRevision: number
  savedCursor: string
  saving: boolean
  updatedAt: string
}

export type ProjectSaveCoordinatorResult
  = | {
    success: true
    newerEdits: boolean
    repositoryRevision: number
    savedIdentity: ProjectSavedIdentity
    snapshot: ProjectSaveCoordinatorSnapshot
  }
  | {
    success: false
    error: ModelDiagnostic
    snapshot: ProjectSaveCoordinatorSnapshot
  }

export interface ProjectSaveCoordinatorOptions {
  createCommitId?: () => string
  projectId: string
  repository: ProjectRepository
  repositoryRevision: number
  savedContentHash: string
  savedCursor: string
  savedEditVersion: number
  createdAt: string
  updatedAt: string
}

export interface ProjectSaveCoordinator {
  readonly snapshot: ProjectSaveCoordinatorSnapshot
  save: (
    capture: ProjectSaveCapture,
    metadata: ProjectCommitMetadata,
    currentIdentity: () => Pick<ProjectSaveCapture, 'contentHash' | 'cursor' | 'editVersion'>,
  ) => Promise<ProjectSaveCoordinatorResult>
  subscribe: (listener: (snapshot: ProjectSaveCoordinatorSnapshot) => void) => () => void
}
