import type {
  PersistedProjectEnvelope,
  ProjectDocument,
  ProjectPage,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
  ProjectRepositoryCreateInput,
  ProjectResourceReference,
  ProjectSummary,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import { getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  assertProjectDocument,
  assertProjectRepositorySeed,
  createMemoryProjectRepository,
  getProjectRepositoryCommitChecksum,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'

const PROJECT_STORAGE_VERSION = 2 as const
const PROJECT_PREFIX = 'project-document:'

interface StoredEntityReference {
  checksum: string
  key: string
  revision: number
}

interface StoredProjectMetadata {
  schemaVersion: ProjectDocument['schemaVersion']
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

interface StoredProjectSnapshotManifest {
  checksum: string
  pages: Record<string, StoredEntityReference>
  project: StoredProjectMetadata
  resources: Record<string, StoredEntityReference>
}

interface StoredCommitReceipt {
  commandId: string
  payloadChecksum: string
  snapshot: StoredProjectSnapshotManifest
}

interface StoredProjectManifest {
  checksum: string
  receipts: StoredCommitReceipt[]
  snapshot: StoredProjectSnapshotManifest
  storageSchemaVersion: typeof PROJECT_STORAGE_VERSION
}

interface StoredProjectEntity {
  checksum: string
  projectId: string
  revision: number
  storageSchemaVersion: typeof PROJECT_STORAGE_VERSION
  value: ProjectPage | ProjectResourceReference
}

type StoredProjectValue = StoredProjectEntity | StoredProjectManifest

interface SnapshotBuildResult {
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

function semanticChecksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function encoded(value: string): string {
  return encodeURIComponent(value)
}

function projectStoragePrefix(id: string): string {
  return `${PROJECT_PREFIX}${encoded(id)}:`
}

function projectManifestKey(id: string): string {
  return `${projectStoragePrefix(id)}manifest`
}

function projectPageKey(projectId: string, pageId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}page:${encoded(pageId)}:${revision}`
}

function projectResourceKey(projectId: string, resourceId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}resource:${encoded(resourceId)}:${revision}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function parseEntityReference(input: unknown, label: string): StoredEntityReference {
  if (!isRecord(input)
    || typeof input.checksum !== 'string'
    || typeof input.key !== 'string'
    || !Number.isInteger(input.revision)
    || Number(input.revision) < 0) {
    corrupt(`Invalid ${label} entity reference.`)
  }
  return structuredClone(input) as unknown as StoredEntityReference
}

function parseReferenceMap(input: unknown, label: string): Record<string, StoredEntityReference> {
  if (!isRecord(input))
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

function parseSnapshotManifest(input: unknown): StoredProjectSnapshotManifest {
  if (!isRecord(input)
    || typeof input.checksum !== 'string'
    || !isRecord(input.project)
    || !Array.isArray(input.project.pageOrder)
    || !input.project.pageOrder.every(id => typeof id === 'string')
    || typeof input.project.id !== 'string'
    || typeof input.project.name !== 'string'
    || !Number.isInteger(input.project.repositoryRevision)
    || Number(input.project.repositoryRevision) < 0
    || typeof input.project.createdAt !== 'string'
    || typeof input.project.updatedAt !== 'string'
    || typeof input.project.homePageId !== 'string'
    || !isRecord(input.project.registryLock)
    || !isRecord(input.project.settings)) {
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

function manifestPayload(manifest: Omit<StoredProjectManifest, 'checksum'>): unknown {
  return {
    receipts: manifest.receipts,
    snapshot: manifest.snapshot,
    storageSchemaVersion: manifest.storageSchemaVersion,
  }
}

function parseStoredManifest(input: unknown): StoredProjectManifest {
  if (!isRecord(input)
    || input.storageSchemaVersion !== PROJECT_STORAGE_VERSION
    || typeof input.checksum !== 'string'
    || !Array.isArray(input.receipts)) {
    corrupt('Stored project manifest is invalid.')
  }
  const receipts = input.receipts.map((receipt, index) => {
    if (!isRecord(receipt)
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
  const candidate: StoredProjectManifest = {
    checksum: input.checksum,
    receipts,
    snapshot: parseSnapshotManifest(input.snapshot),
    storageSchemaVersion: PROJECT_STORAGE_VERSION,
  }
  if (candidate.checksum !== semanticChecksum(manifestPayload(candidate)))
    corrupt(`Stored project manifest checksum mismatch: ${candidate.snapshot.project.id}`)
  return candidate
}

function createStoredManifest(
  snapshot: StoredProjectSnapshotManifest,
  receipts: StoredCommitReceipt[],
): StoredProjectManifest {
  const payload = { receipts, snapshot, storageSchemaVersion: PROJECT_STORAGE_VERSION }
  return { ...payload, checksum: semanticChecksum(payload) }
}

function createSnapshotManifest(
  project: PersistedProjectEnvelope,
  current?: StoredProjectSnapshotManifest,
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
    const key = kind === 'page'
      ? projectPageKey(document.id, id, project.repositoryRevision)
      : projectResourceKey(document.id, id, project.repositoryRevision)
    entities.push({
      checksum: entityChecksum,
      projectId: document.id,
      revision: project.repositoryRevision,
      storageSchemaVersion: PROJECT_STORAGE_VERSION,
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
    schemaVersion: document.schemaVersion,
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

function parseStoredEntity(input: unknown, reference: StoredEntityReference): StoredProjectEntity {
  if (!isRecord(input)
    || input.storageSchemaVersion !== PROJECT_STORAGE_VERSION
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

function createEnvelope(
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

export class IndexedDBProjectRepository implements ProjectRepository {
  readonly persistence = 'durable' as const
  private readonly now: () => string
  private readonly receiptLimit: number
  private readonly storage: IndexDBStorage

  constructor(options: IndexedDBProjectRepositoryOptions) {
    this.receiptLimit = options.receiptLimit ?? 256
    this.now = options.now ?? (() => new Date().toISOString())
    if (!Number.isInteger(this.receiptLimit) || this.receiptLimit < 1)
      throw new RangeError('Project repository receipt limit must be a positive integer.')
    this.storage = new IndexDBStorage({
      dbName: options.dbName ?? 'moluoxixi-config-form-workbench',
      storeName: options.storeName ?? 'workspace-projects',
    })
  }

  async open(): Promise<void> {
    await this.storage.length()
  }

  private async loadSnapshot(snapshot: StoredProjectSnapshotManifest): Promise<PersistedProjectEnvelope> {
    const references = [...Object.values(snapshot.pages), ...Object.values(snapshot.resources)]
    const stored = await this.storage.getItems<StoredProjectValue>(references.map(reference => reference.key))
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
        schemaVersion: snapshot.project.schemaVersion,
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

  async get(id: string): Promise<PersistedProjectEnvelope | undefined> {
    const input = await this.storage.getItem<StoredProjectValue>(projectManifestKey(id))
    if (input === null)
      return undefined
    return await this.loadSnapshot(parseStoredManifest(input).snapshot)
  }

  async list(): Promise<ProjectSummary[]> {
    const keys = (await this.storage.keys())
      .filter(key => key.startsWith(PROJECT_PREFIX) && key.endsWith(':manifest'))
    const records = await this.storage.getItems<StoredProjectValue>(keys)
    return keys.flatMap((key) => {
      const input = records[key]
      if (input === null)
        return []
      const project = parseStoredManifest(input).snapshot.project
      return [{
        id: project.id,
        name: project.name,
        repositoryRevision: project.repositoryRevision,
        homePageId: project.homePageId,
        pageCount: project.pageOrder.length,
        registryLock: project.registryLock,
        updatedAt: project.updatedAt,
      }]
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: ProjectRepositoryCreateInput): Promise<PersistedProjectEnvelope> {
    const document = assertProjectDocument(input.document)
    const timestamp = this.now()
    const seed = assertProjectRepositorySeed(input.seed ?? {
      repositoryRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    const project = createEnvelope(document, seed.repositoryRevision, seed.createdAt, seed.updatedAt)
    const build = createSnapshotManifest(project)
    const manifest = createStoredManifest(build.snapshot, [])
    const manifestKey = projectManifestKey(document.id)
    const keys = [manifestKey, ...build.entityKeys]
    await this.storage.updateItems<StoredProjectValue>(keys, (current) => {
      if (current.get(manifestKey) !== null) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_EXISTS',
          `Project already exists: ${document.id}`,
        )
      }
      return [
        { key: manifestKey, value: manifest },
        ...build.entities.map((entity, index) => ({ key: build.entityKeys[index]!, value: entity })),
      ]
    })
    return await this.loadSnapshot(build.snapshot)
  }

  async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
    const commandId = input.commandId.trim()
    if (!commandId) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_INVALID_COMMIT',
        'Repository commits require a non-empty command id.',
      )
    }
    const document = assertProjectDocument(input.document)
    if (document.id !== input.id) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_INVALID_COMMIT',
        'Repository commit id does not match the project document.',
      )
    }
    const manifestKey = projectManifestKey(input.id)
    const preliminaryInput = await this.storage.getItem<StoredProjectValue>(manifestKey)
    if (preliminaryInput === null) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_NOT_FOUND',
        `Project does not exist: ${input.id}`,
      )
    }
    const preliminary = parseStoredManifest(preliminaryInput)
    const project = createEnvelope(
      document,
      input.expectedRepositoryRevision + 1,
      preliminary.snapshot.project.createdAt,
      this.now(),
    )
    const candidateBuild = createSnapshotManifest(project, preliminary.snapshot)
    const keys = [manifestKey, ...candidateBuild.entityKeys]
    const payloadChecksum = getProjectRepositoryCommitChecksum(input)
    let targetSnapshot: StoredProjectSnapshotManifest | undefined
    let replayed = false

    await this.storage.updateItems<StoredProjectValue>(keys, (currentValues) => {
      const manifestInput = currentValues.get(manifestKey)
      if (manifestInput === null) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project does not exist: ${input.id}`,
        )
      }
      const current = parseStoredManifest(manifestInput)
      const receipt = current.receipts.find(candidate => candidate.commandId === commandId)
      if (receipt) {
        if (receipt.payloadChecksum !== payloadChecksum) {
          throw new ProjectRepositoryError(
            'PROJECT_REPOSITORY_COMMAND_REUSED',
            `Commit command id was reused with a different payload: ${commandId}`,
          )
        }
        targetSnapshot = receipt.snapshot
        replayed = true
        return []
      }
      if (current.snapshot.project.repositoryRevision !== input.expectedRepositoryRevision) {
        throw new ProjectRepositoryError(
          'PROJECT_REVISION_CONFLICT',
          `Expected repository revision ${input.expectedRepositoryRevision}, but repository has ${current.snapshot.project.repositoryRevision}.`,
        )
      }
      if (document.id !== current.snapshot.project.id) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_INVALID_COMMIT',
          'Repository commits cannot change project identity.',
        )
      }

      const build = createSnapshotManifest(project, current.snapshot)
      targetSnapshot = build.snapshot
      const receipts = [
        ...current.receipts,
        { commandId, payloadChecksum, snapshot: build.snapshot },
      ].slice(-this.receiptLimit)
      const manifest = createStoredManifest(build.snapshot, receipts)
      return [
        { key: manifestKey, value: manifest },
        ...build.entities.map((entity, index) => ({ key: build.entityKeys[index]!, value: entity })),
      ]
    })

    if (!targetSnapshot)
      throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', 'Repository commit produced no snapshot.')
    return { project: await this.loadSnapshot(targetSnapshot), replayed }
  }

  async delete(id: string): Promise<void> {
    const keys = (await this.storage.keys()).filter(key => key.startsWith(projectStoragePrefix(id)))
    if (keys.length === 0)
      return
    await this.storage.updateItems<StoredProjectValue>(keys, () => keys.map(key => ({ key, value: null })))
  }

  close(): void {
    this.storage.close()
  }
}

export function createIndexedDBProjectRepository(
  options: IndexedDBProjectRepositoryOptions,
): IndexedDBProjectRepository {
  return new IndexedDBProjectRepository(options)
}

export async function openDefaultProjectRepository(
  options: IndexedDBProjectRepositoryOptions,
): Promise<ProjectRepository> {
  if (!IndexedDBManager.isSupported())
    return createMemoryProjectRepository({ now: options.now, receiptLimit: options.receiptLimit })
  const repository = createIndexedDBProjectRepository(options)
  try {
    await repository.open()
    return repository
  }
  catch {
    repository.close()
    return createMemoryProjectRepository({ now: options.now, receiptLimit: options.receiptLimit })
  }
}
