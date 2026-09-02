import type {
  ProjectDocument,
  ProjectPage,
  ProjectResourceReference,
  ProjectVersionSummary,
  RegistryLock,
} from '@moluoxixi/config-form-model'

export interface StoredEntityReference {
  checksum: string
  key: string
  revision: number
}

export interface StoredProjectMetadata {
  version: ProjectDocument['version']
  id: string
  name: string
  repositoryRevision: number
  createdAt: string
  updatedAt: string
  homePageId: string
  pageOrder: string[]
  registryLock: RegistryLock
  settings: ProjectDocument['settings']
}

export interface StoredProjectSnapshotManifest {
  checksum: string
  pages: Record<string, StoredEntityReference>
  project: StoredProjectMetadata
  resources: Record<string, StoredEntityReference>
}

export interface StoredCommitReceipt {
  commandId: string
  payloadChecksum: string
  snapshot: StoredProjectSnapshotManifest
}

export interface StoredProjectVersion extends ProjectVersionSummary {
  snapshot: StoredProjectSnapshotManifest
}

export interface StoredProjectManifest {
  checksum: string
  receipts: StoredCommitReceipt[]
  snapshot: StoredProjectSnapshotManifest
  version: 3
  versions: StoredProjectVersion[]
}

export interface StoredProjectEntity {
  checksum: string
  projectId: string
  revision: number
  version: 2
  value: ProjectPage | ProjectResourceReference
}

export type StoredProjectValue = StoredProjectEntity | StoredProjectManifest

export interface SnapshotBuildResult {
  entities: StoredProjectEntity[]
  entityKeys: string[]
  snapshot: StoredProjectSnapshotManifest
}

export interface IndexedDBProjectRepositoryOptions {
  dbName?: string
  now?: () => string
  receiptLimit?: number
  storeName?: string
}
