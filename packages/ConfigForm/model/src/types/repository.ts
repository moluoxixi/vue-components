import type {
  ProjectDocument,
  RegistryLock,
} from './contracts'

export type ProjectRepositoryPersistence = 'durable' | 'volatile'

export type ProjectCommitSource = 'autosave' | 'create' | 'manual' | 'restore'

export interface ProjectCommitMetadata {
  source: ProjectCommitSource
  label?: string
  restoredFromRevision?: number
}

export type ProjectRepositoryErrorCode
  = | 'PROJECT_REPOSITORY_COMMAND_REUSED'
    | 'PROJECT_REPOSITORY_CORRUPT'
    | 'PROJECT_REPOSITORY_EXISTS'
    | 'PROJECT_REPOSITORY_INVALID_COMMIT'
    | 'PROJECT_REPOSITORY_NOT_FOUND'
    | 'PROJECT_REVISION_CONFLICT'

export interface ProjectEntityRevisions {
  manifest: number
  pages: Record<string, number>
  resources: Record<string, number>
}

export interface PersistedProjectEnvelope {
  document: ProjectDocument
  repositoryRevision: number
  entityRevisions: ProjectEntityRevisions
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  repositoryRevision: number
  homePageId: string
  pageCount: number
  registryLock: RegistryLock
  updatedAt: string
}

export interface ProjectRepositorySeed {
  repositoryRevision: number
  createdAt: string
  updatedAt: string
}

export interface ProjectRepositoryCreateInput {
  document: ProjectDocument
  seed?: ProjectRepositorySeed
}

export interface ProjectRepositoryCommitInput {
  commandId: string
  document: ProjectDocument
  expectedRepositoryRevision: number
  id: string
  metadata: ProjectCommitMetadata
}

export interface ProjectRepositoryCommitResult {
  project: PersistedProjectEnvelope
  replayed: boolean
}

export interface ProjectVersionSummary {
  projectId: string
  repositoryRevision: number
  source: ProjectCommitSource
  label?: string
  contentHash: string
  createdAt: string
  restoredFromRevision?: number
}

export interface ProjectVersionLabelInput {
  projectId: string
  revision: number
  label?: string
  expectedRepositoryRevision: number
}

export interface ProjectVersionRetentionPolicy {
  keepDailyForDays?: number
  keepLatestAutosaves?: number
  now?: string
}

export interface ProjectRepository {
  readonly persistence: ProjectRepositoryPersistence
  close: () => void
  commit: (input: ProjectRepositoryCommitInput) => Promise<ProjectRepositoryCommitResult>
  create: (input: ProjectRepositoryCreateInput) => Promise<PersistedProjectEnvelope>
  delete: (id: string) => Promise<void>
  get: (id: string) => Promise<PersistedProjectEnvelope | undefined>
  getVersion: (projectId: string, revision: number) => Promise<PersistedProjectEnvelope | undefined>
  list: () => Promise<ProjectSummary[]>
  listVersions: (projectId: string) => Promise<ProjectVersionSummary[]>
  pruneVersions: (projectId: string, policy?: ProjectVersionRetentionPolicy) => Promise<void>
  setVersionLabel: (input: ProjectVersionLabelInput) => Promise<void>
}

export interface MemoryProjectRepositoryOptions {
  now?: () => string
  receiptLimit?: number
}
