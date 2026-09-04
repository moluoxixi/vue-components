import type {
  PersistedProjectEnvelope,
  ProjectDocument,
  ProjectPage,
  ProjectResourceReference,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type { IndexDBStorage } from '@moluoxixi/indexed-db'
import type {
  SnapshotBuildResult,
  StoredCommitReceipt,
  StoredEntityReference,
  StoredProjectEntity,
  StoredProjectManifest,
  StoredProjectMetadata,
  StoredProjectSnapshotManifest,
  StoredProjectValue,
  StoredProjectVersion,
} from '../types'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import { assertProjectDocument, ProjectRepositoryError } from '@moluoxixi/config-form-model'
import { projectManifestKey, projectPageKey, projectResourceKey } from './indexed-db-project-keys'

const PROJECT_MANIFEST_VERSION = 3 as const
const PROJECT_ENTITY_CODEC_VERSION = 2 as const

export function semanticChecksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

export function isStoredRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function parseEntityReference(input: unknown, label: string): StoredEntityReference {
  if (!isStoredRecord(input)
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

function snapshotPayload(snapshot: Omit<StoredProjectSnapshotManifest, 'checksum'>): unknown {
  return {
    pages: snapshot.pages,
    project: snapshot.project,
    resources: snapshot.resources,
  }
}

export function parseSnapshotManifest(input: unknown): StoredProjectSnapshotManifest {
  if (!isStoredRecord(input)
    || typeof input.checksum !== 'string'
    || !isStoredRecord(input.project)
    || !Array.isArray(input.project.pageOrder)
    || !input.project.pageOrder.every(id => typeof id === 'string')
    || typeof input.project.id !== 'string'
    || typeof input.project.name !== 'string'
    || !Number.isInteger(input.project.repositoryRevision)
    || Number(input.project.repositoryRevision) < 0
    || typeof input.project.createdAt !== 'string'
    || typeof input.project.updatedAt !== 'string'
    || typeof input.project.homePageId !== 'string'
    || !isStoredRecord(input.project.registryLock)
    || !isStoredRecord(input.project.settings)) {
    corrupt('Stored project snapshot manifest is invalid.')
  }
  const candidate = {
    checksum: input.checksum,
    pages: parseReferenceMap(input.pages, 'page'),
    project: structuredClone(input.project) as unknown as StoredProjectMetadata,
    resources: parseReferenceMap(input.resources, 'resource'),
  }
  if (candidate.checksum !== semanticChecksum(snapshotPayload(candidate)))
    corrupt(`Stored project snapshot checksum mismatch: ${candidate.project.id}`)
  return candidate
}

function parseReceipts(input: unknown): StoredCommitReceipt[] {
  if (!Array.isArray(input))
    corrupt('Stored project commit receipts are invalid.')
  return input.map((receipt, index) => {
    if (!isStoredRecord(receipt)
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
  if (candidate.checksum !== semanticChecksum(manifestPayload(candidate)))
    corrupt(`Stored project manifest checksum mismatch: ${candidate.snapshot.project.id}`)
  return candidate
}

export async function readCurrentStoredProjectSnapshot(
  storage: Pick<IndexDBStorage, 'getItem'>,
  projectId: string,
): Promise<StoredProjectSnapshotManifest | undefined> {
  const input = await storage.getItem<StoredProjectValue>(projectManifestKey(projectId))
  return input === null ? undefined : parseStoredManifest(input).snapshot
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
    kind: 'page' | 'resource',
    id: string,
    revision: number,
    checksum: string,
  ) => string,
): SnapshotBuildResult {
  const document = assertProjectDocument(project.document)
  const pages: Record<string, StoredEntityReference> = Object.create(null)
  const resources: Record<string, StoredEntityReference> = Object.create(null)
  const entities: StoredProjectEntity[] = []
  const entityKeys: string[] = []

  const storeEntity = (
    id: string,
    value: ProjectPage | ProjectResourceReference,
    kind: 'page' | 'resource',
  ): StoredEntityReference => {
    const entityChecksum = semanticChecksum(value)
    const previous = kind === 'page' ? current?.pages[id] : current?.resources[id]
    if (previous?.checksum === entityChecksum)
      return previous
    const key = createEntityKey
      ? createEntityKey(kind, id, project.repositoryRevision, entityChecksum)
      : kind === 'page'
        ? projectPageKey(document.id, id, project.repositoryRevision)
        : projectResourceKey(document.id, id, project.repositoryRevision)
    entities.push({
      checksum: entityChecksum,
      projectId: document.id,
      revision: project.repositoryRevision,
      version: PROJECT_ENTITY_CODEC_VERSION,
      value,
    })
    entityKeys.push(key)
    return { checksum: entityChecksum, key, revision: project.repositoryRevision }
  }

  Object.entries(document.pagesById).forEach(([id, page]) => {
    pages[id] = storeEntity(id, page, 'page')
  })
  Object.entries(document.resources).forEach(([id, resource]) => {
    resources[id] = storeEntity(id, resource, 'resource')
  })
  const metadata: StoredProjectMetadata = {
    version: document.version,
    id: document.id,
    name: document.name,
    repositoryRevision: project.repositoryRevision,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    homePageId: document.homePageId,
    pageOrder: [...document.pageOrder],
    registryLock: structuredClone(document.registryLock),
    settings: structuredClone(document.settings),
  }
  const payload = { pages, project: metadata, resources }
  return {
    entities,
    entityKeys,
    snapshot: { ...payload, checksum: semanticChecksum(payload) },
  }
}

export function parseStoredEntity(input: unknown, reference: StoredEntityReference): StoredProjectEntity {
  if (!isStoredRecord(input)
    || input.version !== PROJECT_ENTITY_CODEC_VERSION
    || typeof input.checksum !== 'string'
    || typeof input.projectId !== 'string'
    || !Number.isInteger(input.revision)
    || input.value === undefined) {
    corrupt(`Stored project entity is invalid: ${reference.key}`)
  }
  const entity = structuredClone(input) as unknown as StoredProjectEntity
  if (entity.checksum !== reference.checksum || entity.checksum !== semanticChecksum(entity.value))
    corrupt(`Stored project entity checksum mismatch: ${reference.key}`)
  if (entity.revision !== reference.revision)
    corrupt(`Stored project entity revision mismatch: ${reference.key}`)
  return entity
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
    entityRevisions: { manifest: repositoryRevision, pages: {}, resources: {} },
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
    ...Object.values(snapshot.pages).map(reference => reference.key),
    ...Object.values(snapshot.resources).map(reference => reference.key),
  ]
}

export async function loadStoredProjectSnapshot(
  storage: Pick<IndexDBStorage, 'getItems'>,
  snapshot: StoredProjectSnapshotManifest,
): Promise<PersistedProjectEnvelope> {
  const references = [...Object.values(snapshot.pages), ...Object.values(snapshot.resources)]
  const stored = await storage.getItems<StoredProjectValue>(references.map(reference => reference.key))
  const pagesById: ProjectDocument['pagesById'] = Object.create(null)
  const resources: ProjectDocument['resources'] = Object.create(null)
  const pageRevisions: Record<string, number> = Object.create(null)
  const resourceRevisions: Record<string, number> = Object.create(null)
  Object.entries(snapshot.pages).forEach(([id, reference]) => {
    const input = stored[reference.key]
    if (input === null)
      corrupt(`Stored page entity is missing: ${reference.key}`)
    const entity = parseStoredEntity(input, reference)
    if (entity.projectId !== snapshot.project.id)
      corrupt(`Stored page entity belongs to another project: ${reference.key}`)
    pagesById[id] = entity.value as ProjectPage
    pageRevisions[id] = entity.revision
  })
  Object.entries(snapshot.resources).forEach(([id, reference]) => {
    const input = stored[reference.key]
    if (input === null)
      corrupt(`Stored resource entity is missing: ${reference.key}`)
    const entity = parseStoredEntity(input, reference)
    if (entity.projectId !== snapshot.project.id)
      corrupt(`Stored resource entity belongs to another project: ${reference.key}`)
    resources[id] = entity.value as ProjectResourceReference
    resourceRevisions[id] = entity.revision
  })
  let document: ProjectDocument
  try {
    document = assertProjectDocument({
      version: snapshot.project.version,
      id: snapshot.project.id,
      name: snapshot.project.name,
      homePageId: snapshot.project.homePageId,
      pageOrder: snapshot.project.pageOrder,
      registryLock: snapshot.project.registryLock,
      settings: snapshot.project.settings,
      pagesById,
      resources,
    })
  }
  catch (error) {
    corrupt(error instanceof Error ? error.message : String(error))
  }
  return {
    document,
    repositoryRevision: snapshot.project.repositoryRevision,
    entityRevisions: {
      manifest: snapshot.project.repositoryRevision,
      pages: pageRevisions,
      resources: resourceRevisions,
    },
    createdAt: snapshot.project.createdAt,
    updatedAt: snapshot.project.updatedAt,
  }
}
