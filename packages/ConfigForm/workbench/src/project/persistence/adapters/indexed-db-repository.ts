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
  ProjectVersionLabelInput,
  ProjectVersionRetentionPolicy,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type {
  IndexedDBProjectRepositoryOptions,
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
import {
  assertProjectCommitMetadata,
  assertProjectDocument,
  assertProjectRepositorySeed,
  createMemoryProjectRepository,
  getProjectRepositoryCommitChecksum,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'

const PROJECT_MANIFEST_VERSION = 3 as const
const PROJECT_ENTITY_CODEC_VERSION = 2 as const
const PROJECT_PREFIX = 'project-document:'

export function semanticChecksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

function encoded(value: string): string {
  return encodeURIComponent(value)
}

function projectStoragePrefix(id: string): string {
  return `${PROJECT_PREFIX}${encoded(id)}:`
}

export function projectManifestKey(id: string): string {
  return `${projectStoragePrefix(id)}manifest`
}

function projectPageKey(projectId: string, pageId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}page:${encoded(pageId)}:${revision}`
}

function projectResourceKey(projectId: string, resourceId: string, revision: number): string {
  return `${projectStoragePrefix(projectId)}resource:${encoded(resourceId)}:${revision}`
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

function parseStoredManifest(input: unknown): StoredProjectManifest {
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

function createStoredManifest(
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

function createStoredVersion(
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

function versionSummary(version: StoredProjectVersion): ProjectVersionSummary {
  const { snapshot: _snapshot, ...summary } = version
  return structuredClone(summary)
}

function validateRetentionPolicy(
  policy: ProjectVersionRetentionPolicy,
  fallbackNow: string,
): { keepDailyForDays: number, keepLatestAutosaves: number, now: number } {
  const keepDailyForDays = policy.keepDailyForDays ?? 30
  const keepLatestAutosaves = policy.keepLatestAutosaves ?? 50
  const now = Date.parse(policy.now ?? fallbackNow)
  if (!Number.isInteger(keepDailyForDays) || keepDailyForDays < 0
    || !Number.isInteger(keepLatestAutosaves) || keepLatestAutosaves < 0) {
    throw new RangeError('Project version retention limits must be non-negative integers.')
  }
  if (!Number.isFinite(now))
    throw new RangeError('Project version retention time must be a valid ISO date string.')
  return { keepDailyForDays, keepLatestAutosaves, now }
}

function retainedVersions(
  manifest: StoredProjectManifest,
  policy: ReturnType<typeof validateRetentionPolicy>,
): StoredProjectVersion[] {
  const keep = new Set<number>([manifest.snapshot.project.repositoryRevision])
  manifest.receipts.forEach(receipt => keep.add(receipt.snapshot.project.repositoryRevision))
  manifest.versions.forEach((version) => {
    if (version.label)
      keep.add(version.repositoryRevision)
    if (version.restoredFromRevision !== undefined)
      keep.add(version.restoredFromRevision)
  })
  const ordinary = manifest.versions
    .filter(version => !version.label)
    .sort((left, right) => right.repositoryRevision - left.repositoryRevision)
  ordinary.slice(0, policy.keepLatestAutosaves)
    .forEach(version => keep.add(version.repositoryRevision))
  const daily = new Set<string>()
  ordinary.forEach((version) => {
    const timestamp = Date.parse(version.createdAt)
    if (!Number.isFinite(timestamp)
      || policy.now - timestamp > policy.keepDailyForDays * 86_400_000) {
      return
    }
    const day = version.createdAt.slice(0, 10)
    if (!daily.has(day)) {
      daily.add(day)
      keep.add(version.repositoryRevision)
    }
  })
  return manifest.versions.filter(version => keep.has(version.repositoryRevision))
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

  private async ensureManifest(id: string): Promise<StoredProjectManifest | undefined> {
    const input = await this.storage.getItem<StoredProjectValue>(projectManifestKey(id))
    return input === null ? undefined : parseStoredManifest(input)
  }

  async get(id: string): Promise<PersistedProjectEnvelope | undefined> {
    const manifest = await this.ensureManifest(id)
    if (!manifest)
      return undefined
    return await loadStoredProjectSnapshot(this.storage, manifest.snapshot)
  }

  async list(): Promise<ProjectSummary[]> {
    const keys = (await this.storage.keys())
      .filter(key => key.startsWith(PROJECT_PREFIX) && key.endsWith(':manifest'))
    const manifests = await Promise.all(keys.map(async (key) => {
      const marker = `${PROJECT_PREFIX}`
      const encodedId = key.slice(marker.length, -':manifest'.length)
      return await this.ensureManifest(decodeURIComponent(encodedId))
    }))
    return manifests.flatMap((manifest) => {
      if (!manifest)
        return []
      const project = manifest.snapshot.project
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
    const manifest = createStoredManifest(build.snapshot, [], [
      createStoredVersion(project, build.snapshot, { source: 'create' }),
    ])
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
    return await loadStoredProjectSnapshot(this.storage, build.snapshot)
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
    const metadata = assertProjectCommitMetadata(input.metadata)
    if (document.id !== input.id) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_INVALID_COMMIT',
        'Repository commit id does not match the project document.',
      )
    }
    const manifestKey = projectManifestKey(input.id)
    const preliminary = await this.ensureManifest(input.id)
    if (!preliminary) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_NOT_FOUND',
        `Project does not exist: ${input.id}`,
      )
    }
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
      const versions = [
        ...current.versions.filter(version => version.repositoryRevision !== project.repositoryRevision),
        createStoredVersion(project, build.snapshot, metadata),
      ].sort((left, right) => left.repositoryRevision - right.repositoryRevision)
      const manifest = createStoredManifest(build.snapshot, receipts, versions)
      return [
        { key: manifestKey, value: manifest },
        ...build.entities.map((entity, index) => ({ key: build.entityKeys[index]!, value: entity })),
      ]
    })

    if (!targetSnapshot)
      throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', 'Repository commit produced no snapshot.')
    return { project: await loadStoredProjectSnapshot(this.storage, targetSnapshot), replayed }
  }

  async getVersion(
    projectId: string,
    revision: number,
  ): Promise<PersistedProjectEnvelope | undefined> {
    const manifest = await this.ensureManifest(projectId)
    const version = manifest?.versions.find(candidate => candidate.repositoryRevision === revision)
    return version ? await loadStoredProjectSnapshot(this.storage, version.snapshot) : undefined
  }

  async listVersions(projectId: string): Promise<ProjectVersionSummary[]> {
    const manifest = await this.ensureManifest(projectId)
    return manifest
      ? manifest.versions
          .map(versionSummary)
          .sort((left, right) => right.repositoryRevision - left.repositoryRevision)
      : []
  }

  async setVersionLabel(input: ProjectVersionLabelInput): Promise<void> {
    const manifest = await this.ensureManifest(input.projectId)
    if (!manifest) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_NOT_FOUND',
        `Project does not exist: ${input.projectId}`,
      )
    }
    const label = assertProjectCommitMetadata({
      source: 'manual',
      ...(input.label !== undefined ? { label: input.label } : {}),
    }).label
    const manifestKey = projectManifestKey(input.projectId)
    await this.storage.updateItems<StoredProjectValue>([manifestKey], (values) => {
      const currentInput = values.get(manifestKey)
      if (currentInput === null) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project does not exist: ${input.projectId}`,
        )
      }
      const current = parseStoredManifest(currentInput)
      if (current.snapshot.project.repositoryRevision !== input.expectedRepositoryRevision) {
        throw new ProjectRepositoryError(
          'PROJECT_REVISION_CONFLICT',
          `Expected repository revision ${input.expectedRepositoryRevision}, but repository has ${current.snapshot.project.repositoryRevision}.`,
        )
      }
      const index = current.versions.findIndex(version => version.repositoryRevision === input.revision)
      if (index < 0) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project version does not exist: ${input.projectId}@${input.revision}`,
        )
      }
      const versions = [...current.versions]
      const version = { ...versions[index]!, ...(label ? { label } : {}) }
      if (!label)
        delete version.label
      versions[index] = version
      return [{
        key: manifestKey,
        value: createStoredManifest(current.snapshot, current.receipts, versions),
      }]
    })
  }

  async pruneVersions(
    projectId: string,
    inputPolicy: ProjectVersionRetentionPolicy = {},
  ): Promise<void> {
    if (!await this.ensureManifest(projectId))
      return
    const policy = validateRetentionPolicy(inputPolicy, this.now())
    const manifestKey = projectManifestKey(projectId)
    const allKeys = await this.storage.keys()
    const candidates = allKeys.filter(key =>
      key.startsWith(projectStoragePrefix(projectId)) && key !== manifestKey)
    const draftManifestKeys = allKeys.filter(key =>
      key.startsWith('project-recovery-draft:') && key.endsWith(':manifest'))
    const transactionKeys = [manifestKey, ...candidates, ...draftManifestKeys]
    await this.storage.updateItems<unknown>(transactionKeys, (values) => {
      const currentInput = values.get(manifestKey)
      if (currentInput === null)
        return []
      const current = parseStoredManifest(currentInput)
      const versions = retainedVersions(current, policy)
      const reachable = new Set<string>(snapshotReferenceKeys(current.snapshot))
      current.receipts.forEach(receipt =>
        snapshotReferenceKeys(receipt.snapshot).forEach(key => reachable.add(key)))
      versions.forEach(version =>
        snapshotReferenceKeys(version.snapshot).forEach(key => reachable.add(key)))
      draftManifestKeys.forEach((key) => {
        const draft = values.get(key)
        if (!isStoredRecord(draft) || draft.projectId !== projectId)
          return
        try {
          snapshotReferenceKeys(parseSnapshotManifest(draft.snapshot))
            .forEach(reference => reachable.add(reference))
        }
        catch {
          // Corrupt drafts are not valid reachability roots.
        }
      })
      return [
        {
          key: manifestKey,
          value: createStoredManifest(current.snapshot, current.receipts, versions),
        },
        ...candidates
          .filter(key => !reachable.has(key))
          .map(key => ({ key, value: null })),
      ]
    })
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
