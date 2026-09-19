import type {
  ProjectDataset,
  ProjectDocument,
  ProjectResource,
  ProjectSurface,
  ProjectVersionSummary,
  RegistryLock,
} from '@moluoxixi/config-form-model'

export type StoredProjectEntityKind = 'surface' | 'dataset' | 'resource'

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
  manifestRevision: number
  createdAt: string
  updatedAt: string
  homeSurfaceId: string
  surfaceOrder: string[]
  datasetOrder: string[]
  theme: ProjectDocument['theme']
  registryLock: RegistryLock
  settings: ProjectDocument['settings']
}

export interface StoredProjectSnapshotManifest {
  checksum: string
  datasets: Record<string, StoredEntityReference>
  project: StoredProjectMetadata
  resources: Record<string, StoredEntityReference>
  surfaces: Record<string, StoredEntityReference>
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
  version: 4
  versions: StoredProjectVersion[]
}

export interface StoredProjectEntity {
  checksum: string
  id: string
  kind: StoredProjectEntityKind
  projectId: string
  revision: number
  version: 4
  value: ProjectSurface | ProjectDataset | ProjectResource
}

export interface StoredProjectResourceBytes {
  byteLength: number
  bytes: Uint8Array
  contentHash: string
  kind: 'resource-bytes'
  projectId: string
  resourceId: string
  version: 4
}

export type StoredProjectValue
  = | StoredProjectEntity
    | StoredProjectManifest
    | StoredProjectResourceBytes

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
