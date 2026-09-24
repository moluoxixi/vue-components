import type {
  ProjectChangeSet,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ReadonlyProjectDocument,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type {
  StoredProjectEntity,
  StoredProjectSnapshotManifest,
} from './repository'

export type ProjectRecoveryDraftPersistence = 'durable' | 'volatile'

export interface ProjectRecoveryDraftCapture {
  version: 2
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  contentHash: string
  document: ReadonlyProjectDocument
  draftId: string
  editVersion: number
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  projectId: string
  registryLock: RegistryLock
  sessionId: string
}

export interface ProjectRecoveryDraft extends Omit<
  ProjectRecoveryDraftCapture,
  'document' | 'embeddedContents'
> {
  checksum: string
  createdAt: string
  document: ProjectDocument
  embeddedContents: readonly ProjectEmbeddedResourceWrite[]
  updatedAt: string
}

export interface ProjectRecoveryDraftSummary {
  baseRepositoryRevision: number
  changedDatasetIds: string[]
  changedNodeCount: number
  changedResourceIds: string[]
  changedSurfaceIds: string[]
  contentHash: string
  createdAt: string
  draftId: string
  editVersion: number
  projectId: string
  sessionId: string
  updatedAt: string
}

export interface ProjectRecoveryDraftStore {
  readonly persistence: ProjectRecoveryDraftPersistence
  close: () => void
  delete: (draftId: string) => Promise<void>
  get: (draftId: string) => Promise<ProjectRecoveryDraft | undefined>
  list: (projectId?: string) => Promise<readonly ProjectRecoveryDraftSummary[]>
  put: (capture: ProjectRecoveryDraftCapture) => Promise<ProjectRecoveryDraftSummary>
}

export interface StoredRecoveryDraftByteReference {
  byteLength: number
  contentHash: string
  key: string
  resourceId: string
}

export interface StoredRecoveryDraftManifest {
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  checksum: string
  contentHash: string
  createdAt: string
  draftId: string
  editVersion: number
  embeddedResources: StoredRecoveryDraftByteReference[]
  projectId: string
  registryLock: RegistryLock
  sessionId: string
  snapshot: StoredProjectSnapshotManifest
  version: 2
  updatedAt: string
}

export interface StoredRecoveryDraftBytes {
  byteLength: number
  bytes: Uint8Array
  contentHash: string
  draftId: string
  kind: 'resource-bytes'
  projectId: string
  resourceId: string
  version: 2
}

export type StoredDraftValue
  = | StoredProjectEntity
    | StoredRecoveryDraftBytes
    | StoredRecoveryDraftManifest

export interface MemoryProjectRecoveryDraftStoreOptions {
  now?: () => string
}

export interface IndexedDBProjectRecoveryDraftStoreOptions {
  dbName?: string
  now?: () => string
  storeName?: string
}
