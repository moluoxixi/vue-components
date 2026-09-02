import type {
  ProjectChangeSet,
  ProjectDocument,
  ReadonlyProjectDocument,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type { StoredProjectEntity, StoredProjectSnapshotManifest } from './repository'

export type ProjectRecoveryDraftPersistence = 'durable' | 'volatile'

export interface ProjectRecoveryDraftCapture {
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  contentHash: string
  document: ReadonlyProjectDocument
  draftId: string
  editVersion: number
  projectId: string
  registryLock: RegistryLock
  sessionId: string
}

export interface ProjectRecoveryDraft extends Omit<ProjectRecoveryDraftCapture, 'document'> {
  checksum: string
  createdAt: string
  document: ProjectDocument
  updatedAt: string
}

export interface ProjectRecoveryDraftSummary {
  baseRepositoryRevision: number
  changedNodeCount: number
  changedPageIds: string[]
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
  list: (projectId?: string) => Promise<ProjectRecoveryDraftSummary[]>
  put: (capture: ProjectRecoveryDraftCapture) => Promise<ProjectRecoveryDraftSummary>
}

export interface StoredRecoveryDraftManifest {
  baseRepositoryRevision: number
  changeSet: ProjectChangeSet
  checksum: string
  contentHash: string
  createdAt: string
  draftId: string
  editVersion: number
  projectId: string
  registryLock: RegistryLock
  sessionId: string
  snapshot: StoredProjectSnapshotManifest
  version: 1
  updatedAt: string
}

export type StoredDraftValue = StoredProjectEntity | StoredRecoveryDraftManifest

export interface MemoryProjectRecoveryDraftStoreOptions {
  now?: () => string
}

export interface IndexedDBProjectRecoveryDraftStoreOptions {
  dbName?: string
  now?: () => string
  storeName?: string
}
