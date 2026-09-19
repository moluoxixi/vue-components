import type {
  DatasetId,
  ProjectDocument,
  ProjectEmbeddedResourceRead,
  ProjectId,
  RegistryLock,
  ResourceId,
  SurfaceId,
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
  surfaces: Record<SurfaceId, number>
  datasets: Record<DatasetId, number>
  resources: Record<ResourceId, number>
}

export interface PersistedProjectEnvelope {
  document: ProjectDocument
  repositoryRevision: number
  entityRevisions: ProjectEntityRevisions
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: ProjectId
  name: string
  repositoryRevision: number
  homeSurfaceId: SurfaceId
  surfaceCount: number
  datasetCount: number
  resourceCount: number
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
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  seed?: ProjectRepositorySeed
}

export interface ProjectEmbeddedResourceWrite {
  resourceId: ResourceId
  contentHash: string
  bytes: Uint8Array
}

export interface ProjectRepositoryCommitInput {
  commandId: string
  document: ProjectDocument
  embeddedWrites?: readonly ProjectEmbeddedResourceWrite[]
  expectedRepositoryRevision: number
  id: ProjectId
  metadata: ProjectCommitMetadata
}

export interface ProjectRepositoryCommitResult {
  project: PersistedProjectEnvelope
  replayed: boolean
}

export interface ProjectVersionSummary {
  projectId: ProjectId
  repositoryRevision: number
  source: ProjectCommitSource
  label?: string
  contentHash: string
  createdAt: string
  restoredFromRevision?: number
}

export interface ProjectVersionLabelInput {
  projectId: ProjectId
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
  readEmbedded: (input: ProjectEmbeddedResourceRead) => Promise<Uint8Array | undefined>
  setVersionLabel: (input: ProjectVersionLabelInput) => Promise<void>
}

export interface MemoryProjectRepositoryOptions {
  now?: () => string
  receiptLimit?: number
}
