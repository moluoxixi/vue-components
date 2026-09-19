import type {
  PersistedProjectEnvelope,
  ProjectDataset,
  ProjectDocument,
  ProjectResource,
  ProjectSurface,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type { IndexDBStorage } from '@moluoxixi/indexed-db'
import type {
  SnapshotBuildResult,
  StoredCommitReceipt,
  StoredEntityReference,
  StoredProjectEntity,
  StoredProjectEntityKind,
  StoredProjectManifest,
  StoredProjectMetadata,
  StoredProjectResourceBytes,
  StoredProjectSnapshotManifest,
  StoredProjectValue,
  StoredProjectVersion,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  assertProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import {
  projectDatasetKey,
  projectManifestKey,
  projectResourceBytesKey,
  projectResourceKey,
  projectSurfaceKey,
} from './indexed-db-project-keys'
import { validateStoredBytes } from './project-resource-bytes'

const PROJECT_MANIFEST_VERSION = 4 as const
const PROJECT_ENTITY_CODEC_VERSION = 4 as const

export function semanticChecksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

export function isStoredRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(input)
  return keys.length === allowed.length && keys.every(key => allowed.includes(key))
}

function hasAllowedKeys(input: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(input).every(key => allowed.includes(key))
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function parseEntityReference(input: unknown, label: string): StoredEntityReference {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['checksum', 'key', 'revision'])
    || typeof input.checksum !== 'string'
    || typeof input.key !== 'string'
    || !Number.isInteger(input.revision)
    || Number(input.revision) < 0) {
    corrupt(`Invalid ${label} entity reference.`)
  }
  return structuredClone(input) as unknown as StoredEntityReference
}

function parseReferenceMap(input: unknown, label: string): Record<string, StoredEntityReference> {
  if (!isStoredRecord(input))
    corrupt(`Invalid ${label} reference map.`)
  return Object.fromEntries(Object.entries(input).map(([id, reference]) => [
    id,
    parseEntityReference(reference, `${label} ${id}`),
  ]))
}

function assertOrderedMap(
  order: readonly string[],
  map: Readonly<Record<string, unknown>>,
  label: string,
): void {
  if (new Set(order).size !== order.length
    || order.length !== Object.keys(map).length
    || order.some(id => !(id in map))) {
    corrupt(`Stored project ${label} order does not match its reference map.`)
  }
}

function snapshotPayload(snapshot: Omit<StoredProjectSnapshotManifest, 'checksum'>): unknown {
  return {
    datasets: snapshot.datasets,
    project: snapshot.project,
    resources: snapshot.resources,
    surfaces: snapshot.surfaces,
  }
}

function projectManifestContent(input: Pick<
  ProjectDocument,
  'version' | 'id' | 'name' | 'homeSurfaceId' | 'surfaceOrder' | 'datasetOrder' | 'theme' | 'registryLock' | 'settings'
>): unknown {
  return {
    version: input.version,
    id: input.id,
    name: input.name,
    homeSurfaceId: input.homeSurfaceId,
    surfaceOrder: input.surfaceOrder,
    datasetOrder: input.datasetOrder,
    theme: input.theme,
    registryLock: input.registryLock,
    settings: input.settings,
  }
}

export function parseSnapshotManifest(input: unknown): StoredProjectSnapshotManifest {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['checksum', 'datasets', 'project', 'resources', 'surfaces'])
    || typeof input.checksum !== 'string'
    || !isStoredRecord(input.project)
    || !hasOnlyKeys(input.project, [
      'version',
      'id',
      'name',
      'repositoryRevision',
      'manifestRevision',
      'createdAt',
      'updatedAt',
      'homeSurfaceId',
      'surfaceOrder',
      'datasetOrder',
      'theme',
      'registryLock',
      'settings',
    ])
    || !Array.isArray(input.project.surfaceOrder)
    || !input.project.surfaceOrder.every(id => typeof id === 'string')
    || !Array.isArray(input.project.datasetOrder)
    || !input.project.datasetOrder.every(id => typeof id === 'string')
    || typeof input.project.id !== 'string'
    || typeof input.project.name !== 'string'
    || input.project.version !== PROJECT_DOCUMENT_VERSION
    || !Number.isInteger(input.project.repositoryRevision)
    || Number(input.project.repositoryRevision) < 0
    || !Number.isInteger(input.project.manifestRevision)
    || Number(input.project.manifestRevision) < 0
    || Number(input.project.manifestRevision) > Number(input.project.repositoryRevision)
    || typeof input.project.createdAt !== 'string'
    || typeof input.project.updatedAt !== 'string'
    || typeof input.project.homeSurfaceId !== 'string'
    || !isStoredRecord(input.project.theme)
    || !isStoredRecord(input.project.registryLock)
    || !isStoredRecord(input.project.settings)) {
    corrupt('Stored project snapshot manifest is invalid.')
  }
  const candidate: StoredProjectSnapshotManifest = {
    checksum: input.checksum,
    datasets: parseReferenceMap(input.datasets, 'dataset'),
    project: structuredClone(input.project) as unknown as StoredProjectMetadata,
    resources: parseReferenceMap(input.resources, 'resource'),
    surfaces: parseReferenceMap(input.surfaces, 'surface'),
  }
  assertOrderedMap(candidate.project.surfaceOrder, candidate.surfaces, 'Surface')
  assertOrderedMap(candidate.project.datasetOrder, candidate.datasets, 'Dataset')
  if (candidate.checksum !== semanticChecksum(snapshotPayload(candidate)))
    corrupt(`Stored project snapshot checksum mismatch: ${candidate.project.id}`)
  return candidate
}

function parseReceipts(input: unknown): StoredCommitReceipt[] {
  if (!Array.isArray(input))
    corrupt('Stored project commit receipts are invalid.')
  return input.map((receipt, index) => {
    if (!isStoredRecord(receipt)
      || !hasOnlyKeys(receipt, ['commandId', 'payloadChecksum', 'snapshot'])
      || typeof receipt.commandId !== 'string'
      || typeof receipt.payloadChecksum !== 'string') {
      corrupt(`Stored project commit receipt is invalid at index ${index}.`)
    }
    return {
      commandId: receipt.commandId,
      payloadChecksum: receipt.payloadChecksum,
      snapshot: parseSnapshotManifest(receipt.snapshot),
    }
  })
}

function parseVersion(input: unknown, index: number): StoredProjectVersion {
  if (!isStoredRecord(input)
    || !hasAllowedKeys(input, [
      'projectId',
      'repositoryRevision',
      'source',
      'label',
      'contentHash',
      'createdAt',
      'restoredFromRevision',
      'snapshot',
    ])
    || typeof input.projectId !== 'string'
    || !Number.isInteger(input.repositoryRevision)
    || !['autosave', 'create', 'manual', 'restore'].includes(String(input.source))
    || typeof input.contentHash !== 'string'
    || typeof input.createdAt !== 'string'
    || (input.label !== undefined && typeof input.label !== 'string')
    || (input.restoredFromRevision !== undefined && !Number.isInteger(input.restoredFromRevision))) {
    corrupt(`Stored project version is invalid at index ${index}.`)
  }
  const snapshot = parseSnapshotManifest(input.snapshot)
  if (snapshot.project.id !== input.projectId
    || snapshot.project.repositoryRevision !== input.repositoryRevision) {
    corrupt(`Stored project version identity mismatch at index ${index}.`)
  }
  return {
    projectId: input.projectId,
    repositoryRevision: Number(input.repositoryRevision),
    source: input.source as ProjectVersionSummary['source'],
    ...(input.label !== undefined ? { label: input.label } : {}),
    contentHash: input.contentHash,
    createdAt: input.createdAt,
    ...(input.restoredFromRevision !== undefined
      ? { restoredFromRevision: Number(input.restoredFromRevision) }
      : {}),
    snapshot,
  }
}

function manifestPayload(manifest: Omit<StoredProjectManifest, 'checksum'>): unknown {
  return {
    receipts: manifest.receipts,
    snapshot: manifest.snapshot,
    version: manifest.version,
    versions: manifest.versions,
  }
}

export function parseStoredManifest(input: unknown): StoredProjectManifest {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['checksum', 'receipts', 'snapshot', 'version', 'versions'])
    || typeof input.checksum !== 'string'
    || input.version !== PROJECT_MANIFEST_VERSION) {
    corrupt('Stored project manifest is invalid.')
  }
  const receipts = parseReceipts(input.receipts)
  if (!Array.isArray(input.versions))
    corrupt('Stored project versions are invalid.')
  const candidate: StoredProjectManifest = {
    checksum: input.checksum,
    receipts,
    snapshot: parseSnapshotManifest(input.snapshot),
    version: PROJECT_MANIFEST_VERSION,
    versions: input.versions.map(parseVersion),
  }
  if (new Set(candidate.receipts.map(receipt => receipt.commandId)).size !== candidate.receipts.length)
    corrupt('Stored project commit receipt ids are duplicated.')
  if (new Set(candidate.versions.map(version => version.repositoryRevision)).size !== candidate.versions.length)
    corrupt('Stored project version revisions are duplicated.')
  if (candidate.versions.some((version, index) =>
    index > 0 && candidate.versions[index - 1]!.repositoryRevision >= version.repositoryRevision)) {
    corrupt('Stored project versions are not uniquely sorted.')
  }
  const projectId = candidate.snapshot.project.id
  if (candidate.receipts.some(receipt => receipt.snapshot.project.id !== projectId)
    || candidate.versions.some(version => version.snapshot.project.id !== projectId)) {
    corrupt(`Stored project manifest contains a foreign snapshot: ${projectId}`)
  }
  if (candidate.checksum !== semanticChecksum(manifestPayload(candidate)))
    corrupt(`Stored project manifest checksum mismatch: ${candidate.snapshot.project.id}`)
  return candidate
}

export async function readCurrentStoredProjectSnapshot(
  storage: Pick<IndexDBStorage, 'getItem'>,
  projectId: string,
): Promise<StoredProjectSnapshotManifest | undefined> {
  const input = await storage.getItem<StoredProjectValue>(projectManifestKey(projectId))
  if (input === null)
    return undefined
  const snapshot = parseStoredManifest(input).snapshot
  assertFormalSnapshotStorageIdentity(snapshot, projectId)
  return snapshot
}

export function assertFormalSnapshotStorageIdentity(
  snapshot: StoredProjectSnapshotManifest,
  projectId: string,
): void {
  if (snapshot.project.id !== projectId)
    corrupt(`Stored project manifest identity mismatch: ${projectId}`)
  Object.entries(snapshot.surfaces).forEach(([id, reference]) => {
    if (reference.key !== projectSurfaceKey(projectId, id, reference.revision))
      corrupt(`Stored Surface reference key is invalid: ${id}`)
  })
  Object.entries(snapshot.datasets).forEach(([id, reference]) => {
    if (reference.key !== projectDatasetKey(projectId, id, reference.revision))
      corrupt(`Stored Dataset reference key is invalid: ${id}`)
  })
  Object.entries(snapshot.resources).forEach(([id, reference]) => {
    if (reference.key !== projectResourceKey(projectId, id, reference.revision))
      corrupt(`Stored Resource reference key is invalid: ${id}`)
  })
}

export function createStoredManifest(
  snapshot: StoredProjectSnapshotManifest,
  receipts: StoredCommitReceipt[],
  versions: StoredProjectVersion[],
): StoredProjectManifest {
  const payload = {
    receipts,
    snapshot,
    version: PROJECT_MANIFEST_VERSION,
    versions,
  }
  return { ...payload, checksum: semanticChecksum(payload) }
}

export function createStoredVersion(
  project: PersistedProjectEnvelope,
  snapshot: StoredProjectSnapshotManifest,
  metadata: Pick<ProjectVersionSummary, 'source' | 'label' | 'restoredFromRevision'>,
): StoredProjectVersion {
  return {
    projectId: project.document.id,
    repositoryRevision: project.repositoryRevision,
    source: metadata.source,
    ...(metadata.label ? { label: metadata.label } : {}),
    contentHash: semanticChecksum(project.document),
    createdAt: project.updatedAt,
    ...(metadata.restoredFromRevision !== undefined
      ? { restoredFromRevision: metadata.restoredFromRevision }
      : {}),
    snapshot,
  }
}

export function createSnapshotManifest(
  project: PersistedProjectEnvelope,
  current?: StoredProjectSnapshotManifest,
  createEntityKey?: (
    kind: StoredProjectEntityKind,
    id: string,
    revision: number,
    checksum: string,
  ) => string,
): SnapshotBuildResult {
  const document = assertProjectDocument(project.document)
  const surfaces: Record<string, StoredEntityReference> = Object.create(null)
  const datasets: Record<string, StoredEntityReference> = Object.create(null)
  const resources: Record<string, StoredEntityReference> = Object.create(null)
  const entities: StoredProjectEntity[] = []
  const entityKeys: string[] = []

  const storeEntity = (
    id: string,
    value: ProjectSurface | ProjectDataset | ProjectResource,
    kind: StoredProjectEntityKind,
  ): StoredEntityReference => {
    const entityChecksum = semanticChecksum(value)
    const previous = kind === 'surface'
      ? current?.surfaces[id]
      : kind === 'dataset'
        ? current?.datasets[id]
        : current?.resources[id]
    if (previous?.checksum === entityChecksum)
      return previous
    const key = createEntityKey
      ? createEntityKey(kind, id, project.repositoryRevision, entityChecksum)
      : kind === 'surface'
        ? projectSurfaceKey(document.id, id, project.repositoryRevision)
        : kind === 'dataset'
          ? projectDatasetKey(document.id, id, project.repositoryRevision)
          : projectResourceKey(document.id, id, project.repositoryRevision)
    entities.push({
      checksum: entityChecksum,
      id,
      kind,
      projectId: document.id,
      revision: project.repositoryRevision,
      version: PROJECT_ENTITY_CODEC_VERSION,
      value: structuredClone(value),
    })
    entityKeys.push(key)
    return { checksum: entityChecksum, key, revision: project.repositoryRevision }
  }

  document.surfaceOrder.forEach((id) => {
    surfaces[id] = storeEntity(id, document.surfacesById[id]!, 'surface')
  })
  document.datasetOrder.forEach((id) => {
    datasets[id] = storeEntity(id, document.datasetsById[id]!, 'dataset')
  })
  Object.keys(document.resources).sort().forEach((id) => {
    resources[id] = storeEntity(id, document.resources[id]!, 'resource')
  })
  const manifestRevision = current
    && semanticChecksum(projectManifestContent(current.project)) === semanticChecksum(projectManifestContent(document))
    ? current.project.manifestRevision
    : project.repositoryRevision
  const metadata: StoredProjectMetadata = {
    version: document.version,
    id: document.id,
    name: document.name,
    repositoryRevision: project.repositoryRevision,
    manifestRevision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    homeSurfaceId: document.homeSurfaceId,
    surfaceOrder: [...document.surfaceOrder],
    datasetOrder: [...document.datasetOrder],
    theme: structuredClone(document.theme),
    registryLock: structuredClone(document.registryLock),
    settings: structuredClone(document.settings),
  }
  const payload = { datasets, project: metadata, resources, surfaces }
  return {
    entities,
    entityKeys,
    snapshot: { ...payload, checksum: semanticChecksum(payload) },
  }
}

export function parseStoredEntity(
  input: unknown,
  reference: StoredEntityReference,
  kind: StoredProjectEntityKind,
  id: string,
): StoredProjectEntity {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['checksum', 'id', 'kind', 'projectId', 'revision', 'version', 'value'])
    || input.version !== PROJECT_ENTITY_CODEC_VERSION
    || input.kind !== kind
    || input.id !== id
    || typeof input.checksum !== 'string'
    || typeof input.projectId !== 'string'
    || !Number.isInteger(input.revision)
    || input.value === undefined) {
    corrupt(`Stored ${kind} entity is invalid: ${reference.key}`)
  }
  const entity = structuredClone(input) as unknown as StoredProjectEntity
  if (!isStoredRecord(entity.value)
    || entity.value.id !== id
    || (kind === 'surface' && !['page', 'dialog', 'drawer'].includes(String(entity.value.kind)))
    || (kind === 'dataset' && !Array.isArray(entity.value.rows))
    || (kind === 'resource' && !['embedded', 'url'].includes(String(entity.value.kind)))) {
    corrupt(`Stored ${kind} entity identity mismatch: ${reference.key}`)
  }
  if (entity.checksum !== reference.checksum || entity.checksum !== semanticChecksum(entity.value))
    corrupt(`Stored ${kind} entity checksum mismatch: ${reference.key}`)
  if (entity.revision !== reference.revision)
    corrupt(`Stored ${kind} entity revision mismatch: ${reference.key}`)
  return entity
}

export async function parseStoredResourceBytes(
  input: unknown,
  identity: { projectId: string, resourceId: string, contentHash: string },
  version: 4 = PROJECT_ENTITY_CODEC_VERSION,
): Promise<StoredProjectResourceBytes> {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, [
      'byteLength',
      'bytes',
      'contentHash',
      'kind',
      'projectId',
      'resourceId',
      'version',
    ])
    || input.kind !== 'resource-bytes'
    || input.version !== version
    || input.projectId !== identity.projectId
    || input.resourceId !== identity.resourceId
    || input.contentHash !== identity.contentHash
    || !(input.bytes instanceof Uint8Array)
    || !Number.isInteger(input.byteLength)) {
    corrupt(`Stored Resource bytes are invalid: ${identity.resourceId}`)
  }
  try {
    const bytes = await validateStoredBytes({
      byteLength: Number(input.byteLength),
      bytes: input.bytes,
      contentHash: input.contentHash,
    })
    return {
      byteLength: bytes.byteLength,
      bytes,
      contentHash: input.contentHash,
      kind: 'resource-bytes',
      projectId: input.projectId,
      resourceId: input.resourceId,
      version,
    }
  }
  catch {
    corrupt(`Stored Resource bytes are corrupt: ${identity.resourceId}`)
  }
}

export function createEnvelope(
  document: ProjectDocument,
  repositoryRevision: number,
  createdAt: string,
  updatedAt: string,
): PersistedProjectEnvelope {
  return {
    document,
    repositoryRevision,
    entityRevisions: {
      manifest: repositoryRevision,
      surfaces: {},
      datasets: {},
      resources: {},
    },
    createdAt,
    updatedAt,
  }
}

export function versionSummary(version: StoredProjectVersion): ProjectVersionSummary {
  const { snapshot: _snapshot, ...summary } = version
  return structuredClone(summary)
}

export function snapshotReferenceKeys(snapshot: StoredProjectSnapshotManifest): string[] {
  return [
    ...Object.values(snapshot.surfaces).map(reference => reference.key),
    ...Object.values(snapshot.datasets).map(reference => reference.key),
    ...Object.values(snapshot.resources).map(reference => reference.key),
  ]
}

export function snapshotResourceReferences(
  snapshot: StoredProjectSnapshotManifest,
): Array<[string, StoredEntityReference]> {
  return Object.entries(snapshot.resources)
}

export function loadStoredProjectSnapshotFromValues(
  stored: ReadonlyMap<string, StoredProjectValue | null | undefined>,
  snapshot: StoredProjectSnapshotManifest,
): PersistedProjectEnvelope {
  const surfaceEntries = Object.entries(snapshot.surfaces)
  const datasetEntries = Object.entries(snapshot.datasets)
  const resourceEntries = Object.entries(snapshot.resources)
  const surfacesById: ProjectDocument['surfacesById'] = Object.create(null)
  const datasetsById: ProjectDocument['datasetsById'] = Object.create(null)
  const resources: ProjectDocument['resources'] = Object.create(null)
  const surfaceRevisions: Record<string, number> = Object.create(null)
  const datasetRevisions: Record<string, number> = Object.create(null)
  const resourceRevisions: Record<string, number> = Object.create(null)

  const loadEntity = (
    id: string,
    reference: StoredEntityReference,
    kind: StoredProjectEntityKind,
  ): StoredProjectEntity => {
    const input = stored.get(reference.key)
    if (input === null || input === undefined)
      corrupt(`Stored ${kind} entity is missing: ${reference.key}`)
    const entity = parseStoredEntity(input, reference, kind, id)
    if (entity.projectId !== snapshot.project.id)
      corrupt(`Stored ${kind} entity belongs to another project: ${reference.key}`)
    return entity
  }

  surfaceEntries.forEach(([id, reference]) => {
    const entity = loadEntity(id, reference, 'surface')
    surfacesById[id] = entity.value as ProjectSurface
    surfaceRevisions[id] = entity.revision
  })
  datasetEntries.forEach(([id, reference]) => {
    const entity = loadEntity(id, reference, 'dataset')
    datasetsById[id] = entity.value as ProjectDataset
    datasetRevisions[id] = entity.revision
  })
  resourceEntries.forEach(([id, reference]) => {
    const entity = loadEntity(id, reference, 'resource')
    resources[id] = entity.value as ProjectResource
    resourceRevisions[id] = entity.revision
  })

  let document: ProjectDocument
  try {
    document = assertProjectDocument({
      version: snapshot.project.version,
      id: snapshot.project.id,
      name: snapshot.project.name,
      homeSurfaceId: snapshot.project.homeSurfaceId,
      surfaceOrder: snapshot.project.surfaceOrder,
      surfacesById,
      datasetOrder: snapshot.project.datasetOrder,
      datasetsById,
      resources,
      theme: snapshot.project.theme,
      registryLock: snapshot.project.registryLock,
      settings: snapshot.project.settings,
    })
  }
  catch (error) {
    corrupt(error instanceof Error ? error.message : String(error))
  }
  return {
    document,
    repositoryRevision: snapshot.project.repositoryRevision,
    entityRevisions: {
      manifest: snapshot.project.manifestRevision,
      surfaces: surfaceRevisions,
      datasets: datasetRevisions,
      resources: resourceRevisions,
    },
    createdAt: snapshot.project.createdAt,
    updatedAt: snapshot.project.updatedAt,
  }
}

export async function loadStoredProjectSnapshot(
  storage: Pick<IndexDBStorage, 'getItems'>,
  snapshot: StoredProjectSnapshotManifest,
): Promise<PersistedProjectEnvelope> {
  const keys = snapshotReferenceKeys(snapshot)
  const stored = await storage.getItems<StoredProjectValue>(keys)
  return loadStoredProjectSnapshotFromValues(
    new Map(keys.map(key => [key, stored[key] ?? null])),
    snapshot,
  )
}

export function resourceBytesKeyForEntity(
  projectId: string,
  resource: ProjectResource,
): string | undefined {
  return resource.kind === 'embedded'
    ? projectResourceBytesKey(projectId, resource.id, resource.contentHash)
    : undefined
}
