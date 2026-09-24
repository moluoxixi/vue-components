import type {
  ProjectChangeSet,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type {
  IndexedDBProjectRecoveryDraftStoreOptions,
  MemoryProjectRecoveryDraftStoreOptions,
  ProjectRecoveryDraft,
  ProjectRecoveryDraftCapture,
  ProjectRecoveryDraftStore,
  ProjectRecoveryDraftSummary,
  StoredDraftValue,
  StoredProjectSnapshotManifest,
  StoredRecoveryDraftByteReference,
  StoredRecoveryDraftBytes,
  StoredRecoveryDraftManifest,
} from '../types'
import {
  assertProjectDocument,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { readItemsByPrefix, updateItemsByPrefix } from './indexed-db-prefix-transaction'
import {
  createSnapshotManifest,
  isStoredRecord,
  loadStoredProjectSnapshot,
  parseSnapshotManifest,
  semanticChecksum,
  snapshotReferenceKeys,
} from './indexed-db-project-codec'
import {
  cloneEmbeddedResourceWrites,
  validateEmbeddedResourceWrites,
  validateStoredBytes,
} from './project-resource-bytes'

const DRAFT_STORAGE_VERSION = 2 as const
const DRAFT_PREFIX = 'project-recovery-draft:'

function encoded(value: string): string {
  return encodeURIComponent(value)
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = Object.keys(input)
  return keys.length === allowed.length && keys.every(key => allowed.includes(key))
}

function hasAllowedKeys(input: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(input).every(key => allowed.includes(key))
}

function draftStoragePrefix(projectId: string, draftId: string): string {
  return `${DRAFT_PREFIX}${encoded(projectId)}:${encoded(draftId)}:`
}

function draftManifestKey(projectId: string, draftId: string): string {
  return `${draftStoragePrefix(projectId, draftId)}manifest`
}

function draftEntityKey(
  projectId: string,
  draftId: string,
  editVersion: number,
  kind: 'surface' | 'dataset' | 'resource',
  id: string,
  checksum: string,
): string {
  return `${draftStoragePrefix(projectId, draftId)}${kind}:${encoded(id)}:${editVersion}:${encoded(checksum)}`
}

function draftByteKey(
  projectId: string,
  draftId: string,
  resourceId: string,
  contentHash: string,
): string {
  return `${draftStoragePrefix(projectId, draftId)}resource-bytes:${encoded(resourceId)}:${encoded(contentHash)}`
}

function draftIdFromStorageKey(key: string): string | undefined {
  if (!key.startsWith(DRAFT_PREFIX))
    return undefined
  const identity = key.slice(DRAFT_PREFIX.length)
  const projectSeparator = identity.indexOf(':')
  const draftSeparator = identity.indexOf(':', projectSeparator + 1)
  if (projectSeparator < 0 || draftSeparator < 0)
    return undefined
  try {
    return decodeURIComponent(identity.slice(projectSeparator + 1, draftSeparator))
  }
  catch {
    return undefined
  }
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function parseRelation(input: unknown): void {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['parentId', 'slot'])
    || (input.parentId !== null && typeof input.parentId !== 'string')
    || (input.slot !== null && typeof input.slot !== 'string')) {
    corrupt('Stored recovery draft node relation is invalid.')
  }
}

function parseChangeSet(input: unknown): ProjectChangeSet {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['project', 'surfaceIds', 'datasetIds', 'resourceIds', 'nodeChanges'])
    || typeof input.project !== 'boolean'
    || !Array.isArray(input.surfaceIds)
    || !input.surfaceIds.every(id => typeof id === 'string')
    || !Array.isArray(input.datasetIds)
    || !input.datasetIds.every(id => typeof id === 'string')
    || !Array.isArray(input.resourceIds)
    || !input.resourceIds.every(id => typeof id === 'string')
    || !Array.isArray(input.nodeChanges)) {
    corrupt('Stored recovery draft change set is invalid.')
  }
  input.nodeChanges.forEach((change) => {
    if (!isStoredRecord(change)
      || !hasAllowedKeys(change, ['surfaceId', 'nodeId', 'kind', 'before', 'after'])
      || typeof change.surfaceId !== 'string'
      || typeof change.nodeId !== 'string'
      || !['content', 'insert', 'move', 'remove'].includes(String(change.kind))) {
      corrupt('Stored recovery draft node change is invalid.')
    }
    if (change.before !== undefined)
      parseRelation(change.before)
    if (change.after !== undefined)
      parseRelation(change.after)
  })
  return structuredClone(input) as unknown as ProjectChangeSet
}

function parseByteReference(
  input: unknown,
  projectId: string,
  draftId: string,
): StoredRecoveryDraftByteReference {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, ['byteLength', 'contentHash', 'key', 'resourceId'])
    || !Number.isInteger(input.byteLength)
    || Number(input.byteLength) < 0
    || typeof input.contentHash !== 'string'
    || typeof input.key !== 'string'
    || typeof input.resourceId !== 'string'
    || input.key !== draftByteKey(projectId, draftId, input.resourceId, input.contentHash)) {
    corrupt('Stored recovery draft byte reference is invalid.')
  }
  return structuredClone(input) as unknown as StoredRecoveryDraftByteReference
}

function manifestPayload(manifest: Omit<StoredRecoveryDraftManifest, 'checksum'>): unknown {
  return {
    baseRepositoryRevision: manifest.baseRepositoryRevision,
    changeSet: manifest.changeSet,
    contentHash: manifest.contentHash,
    createdAt: manifest.createdAt,
    draftId: manifest.draftId,
    editVersion: manifest.editVersion,
    embeddedResources: manifest.embeddedResources,
    projectId: manifest.projectId,
    registryLock: manifest.registryLock,
    sessionId: manifest.sessionId,
    snapshot: manifest.snapshot,
    version: manifest.version,
    updatedAt: manifest.updatedAt,
  }
}

function createManifest(
  capture: ProjectRecoveryDraftCapture,
  snapshot: StoredProjectSnapshotManifest,
  embeddedResources: StoredRecoveryDraftByteReference[],
  createdAt: string,
  updatedAt: string,
): StoredRecoveryDraftManifest {
  const payload = {
    baseRepositoryRevision: capture.baseRepositoryRevision,
    changeSet: structuredClone(capture.changeSet),
    contentHash: capture.contentHash,
    createdAt,
    draftId: capture.draftId,
    editVersion: capture.editVersion,
    embeddedResources: structuredClone(embeddedResources),
    projectId: capture.projectId,
    registryLock: structuredClone(capture.registryLock),
    sessionId: capture.sessionId,
    snapshot,
    version: DRAFT_STORAGE_VERSION,
    updatedAt,
  }
  return { ...payload, checksum: semanticChecksum(payload) }
}

function parseManifest(input: unknown): StoredRecoveryDraftManifest {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, [
      'baseRepositoryRevision',
      'changeSet',
      'checksum',
      'contentHash',
      'createdAt',
      'draftId',
      'editVersion',
      'embeddedResources',
      'projectId',
      'registryLock',
      'sessionId',
      'snapshot',
      'version',
      'updatedAt',
    ])
    || input.version !== DRAFT_STORAGE_VERSION
    || typeof input.checksum !== 'string'
    || typeof input.draftId !== 'string'
    || typeof input.projectId !== 'string'
    || typeof input.sessionId !== 'string'
    || !Number.isInteger(input.baseRepositoryRevision)
    || Number(input.baseRepositoryRevision) < 0
    || !Number.isInteger(input.editVersion)
    || Number(input.editVersion) < 0
    || typeof input.contentHash !== 'string'
    || typeof input.createdAt !== 'string'
    || typeof input.updatedAt !== 'string'
    || !Array.isArray(input.embeddedResources)
    || !isStoredRecord(input.registryLock)) {
    corrupt('Stored recovery draft manifest is invalid.')
  }
  const projectId = input.projectId
  const draftId = input.draftId
  const embeddedResources = input.embeddedResources.map(reference =>
    parseByteReference(reference, projectId, draftId))
  if (new Set(embeddedResources.map(reference => reference.resourceId)).size !== embeddedResources.length
    || embeddedResources.some((reference, index) =>
      index > 0 && embeddedResources[index - 1]!.resourceId.localeCompare(reference.resourceId) >= 0)) {
    corrupt('Stored recovery draft byte references are not uniquely sorted.')
  }
  const candidate: StoredRecoveryDraftManifest = {
    baseRepositoryRevision: Number(input.baseRepositoryRevision),
    changeSet: parseChangeSet(input.changeSet),
    checksum: input.checksum,
    contentHash: input.contentHash,
    createdAt: input.createdAt,
    draftId: input.draftId,
    editVersion: Number(input.editVersion),
    embeddedResources,
    projectId: input.projectId,
    registryLock: structuredClone(input.registryLock) as unknown as RegistryLock,
    sessionId: input.sessionId,
    snapshot: parseSnapshotManifest(input.snapshot),
    version: DRAFT_STORAGE_VERSION,
    updatedAt: input.updatedAt,
  }
  if (candidate.checksum !== semanticChecksum(manifestPayload(candidate)))
    corrupt(`Stored recovery draft checksum mismatch: ${candidate.draftId}`)
  if (candidate.snapshot.project.id !== candidate.projectId
    || candidate.snapshot.project.repositoryRevision !== candidate.baseRepositoryRevision) {
    corrupt(`Stored recovery draft identity mismatch: ${candidate.draftId}`)
  }
  return candidate
}

function parseManifestAtKey(input: unknown, key: string): StoredRecoveryDraftManifest {
  const manifest = parseManifest(input)
  if (key !== draftManifestKey(manifest.projectId, manifest.draftId))
    corrupt(`Stored recovery draft manifest key is invalid: ${manifest.draftId}`)
  const assertEntityKeys = (
    kind: 'surface' | 'dataset' | 'resource',
    references: Readonly<Record<string, { checksum: string, key: string }>>,
  ) => Object.entries(references).forEach(([id, reference]) => {
    const expected = draftEntityKey(
      manifest.projectId,
      manifest.draftId,
      manifest.editVersion,
      kind,
      id,
      reference.checksum,
    )
    if (reference.key !== expected)
      corrupt(`Stored recovery draft ${kind} key is invalid: ${id}`)
  })
  assertEntityKeys('surface', manifest.snapshot.surfaces)
  assertEntityKeys('dataset', manifest.snapshot.datasets)
  assertEntityKeys('resource', manifest.snapshot.resources)
  return manifest
}

function summary(manifest: StoredRecoveryDraftManifest): ProjectRecoveryDraftSummary {
  return {
    baseRepositoryRevision: manifest.baseRepositoryRevision,
    changedDatasetIds: [...manifest.changeSet.datasetIds],
    changedNodeCount: manifest.changeSet.nodeChanges.length,
    changedResourceIds: [...manifest.changeSet.resourceIds],
    changedSurfaceIds: [...manifest.changeSet.surfaceIds],
    contentHash: manifest.contentHash,
    createdAt: manifest.createdAt,
    draftId: manifest.draftId,
    editVersion: manifest.editVersion,
    projectId: manifest.projectId,
    sessionId: manifest.sessionId,
    updatedAt: manifest.updatedAt,
  }
}

async function assertCapture(capture: ProjectRecoveryDraftCapture): Promise<ProjectRecoveryDraftCapture> {
  const version = capture.version
  const baseRepositoryRevision = capture.baseRepositoryRevision
  const contentHash = capture.contentHash
  const document = assertProjectDocument(capture.document)
  const draftId = capture.draftId.trim()
  const editVersion = capture.editVersion
  const embeddedContentsInput = cloneEmbeddedResourceWrites(capture.embeddedContents)
  const projectId = capture.projectId
  const registryLock = structuredClone(capture.registryLock)
  const sessionId = capture.sessionId.trim()
  const changeSet = parseChangeSet(structuredClone(capture.changeSet))
  if (version !== DRAFT_STORAGE_VERSION
    || !draftId
    || !sessionId
    || projectId !== document.id) {
    throw new TypeError('Recovery draft identity is invalid.')
  }
  if (!Number.isInteger(baseRepositoryRevision) || baseRepositoryRevision < 0
    || !Number.isInteger(editVersion) || editVersion < 0) {
    throw new TypeError('Recovery draft revisions must be non-negative integers.')
  }
  if (semanticChecksum(document.registryLock) !== semanticChecksum(registryLock))
    throw new TypeError('Recovery draft Registry lock does not match the document.')
  const embeddedContents = await validateEmbeddedResourceWrites(
    document,
    embeddedContentsInput,
    true,
  )
  return {
    version: DRAFT_STORAGE_VERSION,
    baseRepositoryRevision,
    changeSet,
    contentHash,
    document,
    draftId,
    editVersion,
    embeddedContents,
    projectId,
    registryLock,
    sessionId,
  }
}

function cloneDraft(draft: ProjectRecoveryDraft): ProjectRecoveryDraft {
  return {
    ...structuredClone(draft),
    document: assertProjectDocument(draft.document),
    embeddedContents: cloneEmbeddedResourceWrites(draft.embeddedContents),
  }
}

function draftProjectEnvelope(
  document: ProjectDocument,
  repositoryRevision: number,
  createdAt: string,
  updatedAt: string,
) {
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

function byteReferences(
  capture: ProjectRecoveryDraftCapture,
): StoredRecoveryDraftByteReference[] {
  return capture.embeddedContents.map(write => ({
    byteLength: write.bytes.byteLength,
    contentHash: write.contentHash,
    key: draftByteKey(capture.projectId, capture.draftId, write.resourceId, write.contentHash),
    resourceId: write.resourceId,
  }))
}

function byteRecords(
  capture: ProjectRecoveryDraftCapture,
): StoredRecoveryDraftBytes[] {
  return capture.embeddedContents.map(write => ({
    byteLength: write.bytes.byteLength,
    bytes: new Uint8Array(write.bytes),
    contentHash: write.contentHash,
    draftId: capture.draftId,
    kind: 'resource-bytes',
    projectId: capture.projectId,
    resourceId: write.resourceId,
    version: DRAFT_STORAGE_VERSION,
  }))
}

async function parseStoredDraftBytes(
  input: unknown,
  manifest: StoredRecoveryDraftManifest,
  reference: StoredRecoveryDraftByteReference,
): Promise<ProjectEmbeddedResourceWrite> {
  if (!isStoredRecord(input)
    || !hasOnlyKeys(input, [
      'byteLength',
      'bytes',
      'contentHash',
      'draftId',
      'kind',
      'projectId',
      'resourceId',
      'version',
    ])
    || input.version !== DRAFT_STORAGE_VERSION
    || input.kind !== 'resource-bytes'
    || input.projectId !== manifest.projectId
    || input.draftId !== manifest.draftId
    || input.resourceId !== reference.resourceId
    || input.contentHash !== reference.contentHash
    || input.byteLength !== reference.byteLength
    || !(input.bytes instanceof Uint8Array)) {
    corrupt(`Stored recovery draft bytes are invalid: ${reference.resourceId}`)
  }
  try {
    const bytes = await validateStoredBytes({
      byteLength: reference.byteLength,
      bytes: input.bytes,
      contentHash: reference.contentHash,
    })
    return {
      resourceId: reference.resourceId,
      contentHash: reference.contentHash,
      bytes,
    }
  }
  catch {
    corrupt(`Stored recovery draft bytes are corrupt: ${reference.resourceId}`)
  }
}

export class MemoryProjectRecoveryDraftStore implements ProjectRecoveryDraftStore {
  readonly persistence = 'volatile' as const
  private readonly drafts = new Map<string, ProjectRecoveryDraft>()
  private readonly now: () => string

  constructor(options: MemoryProjectRecoveryDraftStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async put(input: ProjectRecoveryDraftCapture): Promise<ProjectRecoveryDraftSummary> {
    const capture = await assertCapture(input)
    const current = this.drafts.get(capture.draftId)
    if (current && current.editVersion > capture.editVersion)
      return summaryFromDraft(current)
    const updatedAt = this.now()
    const createdAt = current?.createdAt ?? updatedAt
    const project = draftProjectEnvelope(
      assertProjectDocument(capture.document),
      capture.baseRepositoryRevision,
      createdAt,
      updatedAt,
    )
    const build = createSnapshotManifest(project, undefined, (kind, id, _revision, checksum) =>
      draftEntityKey(capture.projectId, capture.draftId, capture.editVersion, kind, id, checksum))
    const manifest = createManifest(capture, build.snapshot, byteReferences(capture), createdAt, updatedAt)
    const draft: ProjectRecoveryDraft = {
      ...capture,
      checksum: manifest.checksum,
      createdAt,
      document: assertProjectDocument(capture.document),
      embeddedContents: cloneEmbeddedResourceWrites(capture.embeddedContents),
      updatedAt,
    }
    this.drafts.set(capture.draftId, cloneDraft(draft))
    return summaryFromDraft(draft)
  }

  async get(draftId: string): Promise<ProjectRecoveryDraft | undefined> {
    const draft = this.drafts.get(draftId)
    return draft ? cloneDraft(draft) : undefined
  }

  async list(projectId?: string): Promise<readonly ProjectRecoveryDraftSummary[]> {
    return [...this.drafts.values()]
      .filter(draft => !projectId || draft.projectId === projectId)
      .map(summaryFromDraft)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async delete(draftId: string): Promise<void> {
    this.drafts.delete(draftId)
  }

  close(): void {}
}

function summaryFromDraft(draft: ProjectRecoveryDraft): ProjectRecoveryDraftSummary {
  return {
    baseRepositoryRevision: draft.baseRepositoryRevision,
    changedDatasetIds: [...draft.changeSet.datasetIds],
    changedNodeCount: draft.changeSet.nodeChanges.length,
    changedResourceIds: [...draft.changeSet.resourceIds],
    changedSurfaceIds: [...draft.changeSet.surfaceIds],
    contentHash: draft.contentHash,
    createdAt: draft.createdAt,
    draftId: draft.draftId,
    editVersion: draft.editVersion,
    projectId: draft.projectId,
    sessionId: draft.sessionId,
    updatedAt: draft.updatedAt,
  }
}

export class IndexedDBProjectRecoveryDraftStore implements ProjectRecoveryDraftStore {
  readonly persistence = 'durable' as const
  private readonly dbName: string
  private readonly now: () => string
  private readonly storage: IndexDBStorage
  private readonly storeName: string

  constructor(options: IndexedDBProjectRecoveryDraftStoreOptions = {}) {
    this.dbName = options.dbName ?? 'moluoxixi-config-form-workbench'
    this.now = options.now ?? (() => new Date().toISOString())
    this.storeName = options.storeName ?? 'workspace-projects'
    this.storage = new IndexDBStorage({
      dbName: this.dbName,
      storeName: this.storeName,
    })
  }

  async open(): Promise<void> {
    await this.storage.length()
  }

  async put(input: ProjectRecoveryDraftCapture): Promise<ProjectRecoveryDraftSummary> {
    const capture = await assertCapture(input)
    const manifestKey = draftManifestKey(capture.projectId, capture.draftId)
    const updatedAt = this.now()
    const project = draftProjectEnvelope(
      assertProjectDocument(capture.document),
      capture.baseRepositoryRevision,
      updatedAt,
      updatedAt,
    )
    const build = createSnapshotManifest(
      project,
      undefined,
      (kind, id, _revision, checksum) => draftEntityKey(
        capture.projectId,
        capture.draftId,
        capture.editVersion,
        kind,
        id,
        checksum,
      ),
    )
    const references = byteReferences(capture)
    const records = byteRecords(capture)
    const namespacePrefix = draftStoragePrefix(capture.projectId, capture.draftId)
    const additionalKeys = [
      manifestKey,
      ...build.entityKeys,
      ...references.map(reference => reference.key),
    ]
    let accepted: StoredRecoveryDraftManifest | undefined
    await updateItemsByPrefix<StoredDraftValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [namespacePrefix],
      additionalKeys,
    }, (values) => {
      const currentInput = values.get(manifestKey)
      const current = currentInput === null ? undefined : parseManifestAtKey(currentInput, manifestKey)
      if (current && current.editVersion > capture.editVersion) {
        accepted = current
        return []
      }
      const manifest = createManifest(
        capture,
        build.snapshot,
        references,
        current?.createdAt ?? updatedAt,
        updatedAt,
      )
      accepted = manifest
      const reachable = new Set([
        manifestKey,
        ...snapshotReferenceKeys(build.snapshot),
        ...references.map(reference => reference.key),
      ])
      return [
        { key: manifestKey, value: manifest },
        ...build.entities.map((entity, index) => ({
          key: build.entityKeys[index]!,
          value: entity as StoredDraftValue,
        })),
        ...records.map((record, index) => ({
          key: references[index]!.key,
          value: record as StoredDraftValue,
        })),
        ...[...values.keys()]
          .filter(key => !reachable.has(key))
          .map(key => ({ key, value: null })),
      ]
    })
    if (!accepted)
      corrupt(`Recovery draft write produced no manifest: ${capture.draftId}`)
    return summary(accepted)
  }

  async get(draftId: string): Promise<ProjectRecoveryDraft | undefined> {
    const values = await readItemsByPrefix<StoredDraftValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [DRAFT_PREFIX],
    })
    const keys = [...values.keys()].filter(key =>
      draftIdFromStorageKey(key) === draftId && key.endsWith(':manifest'))
    if (keys.length === 0)
      return undefined
    if (keys.length > 1)
      corrupt(`Recovery draft id is ambiguous: ${draftId}`)
    const input = values.get(keys[0]!)
    if (input === undefined)
      corrupt(`Recovery draft manifest is missing: ${draftId}`)
    const manifest = parseManifestAtKey(input, keys[0]!)
    const mapStorage = {
      async getItems<T>(requestedKeys: string[]): Promise<Record<string, T | null>> {
        return Object.fromEntries(requestedKeys.map(key => [
          key,
          (values.get(key) as T | undefined) ?? null,
        ]))
      },
    }
    const project = await loadStoredProjectSnapshot(mapStorage, manifest.snapshot)
    if (semanticChecksum(project.document.registryLock) !== semanticChecksum(manifest.registryLock))
      corrupt(`Recovery draft Registry lock mismatch: ${draftId}`)
    const embeddedContents = await Promise.all(manifest.embeddedResources.map((reference) => {
      const value = values.get(reference.key)
      if (value === undefined)
        corrupt(`Stored recovery draft bytes are missing: ${reference.resourceId}`)
      return parseStoredDraftBytes(value, manifest, reference)
    }))
    let validated: ProjectEmbeddedResourceWrite[]
    try {
      validated = await validateEmbeddedResourceWrites(project.document, embeddedContents, true)
    }
    catch (error) {
      corrupt(error instanceof Error ? error.message : String(error))
    }
    return {
      version: DRAFT_STORAGE_VERSION,
      baseRepositoryRevision: manifest.baseRepositoryRevision,
      changeSet: structuredClone(manifest.changeSet),
      checksum: manifest.checksum,
      contentHash: manifest.contentHash,
      createdAt: manifest.createdAt,
      document: project.document,
      draftId: manifest.draftId,
      editVersion: manifest.editVersion,
      embeddedContents: cloneEmbeddedResourceWrites(validated),
      projectId: manifest.projectId,
      registryLock: structuredClone(manifest.registryLock),
      sessionId: manifest.sessionId,
      updatedAt: manifest.updatedAt,
    }
  }

  async list(projectId?: string): Promise<readonly ProjectRecoveryDraftSummary[]> {
    const values = await readItemsByPrefix<StoredDraftValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [DRAFT_PREFIX],
    })
    const keys = [...values.keys()].filter(key => key.endsWith(':manifest'))
    return keys.flatMap((key) => {
      const value = values.get(key)!
      const manifest = parseManifestAtKey(value, key)
      return projectId && manifest.projectId !== projectId ? [] : [summary(manifest)]
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async delete(draftId: string): Promise<void> {
    await updateItemsByPrefix<StoredDraftValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [DRAFT_PREFIX],
    }, (values) => {
      const manifests = [...values.entries()].flatMap(([key, value]) => {
        if (!key.endsWith(':manifest') || draftIdFromStorageKey(key) !== draftId || value === null)
          return []
        return [{ key, manifest: parseManifestAtKey(value, key) }]
      })
      if (manifests.length > 1)
        corrupt(`Recovery draft id is ambiguous: ${draftId}`)
      const target = manifests[0]
      if (!target)
        return []
      const prefix = draftStoragePrefix(target.manifest.projectId, target.manifest.draftId)
      return [...values.keys()]
        .filter(key => key.startsWith(prefix))
        .map(key => ({ key, value: null }))
    })
  }

  close(): void {
    this.storage.close()
  }
}

export function createMemoryProjectRecoveryDraftStore(
  options?: MemoryProjectRecoveryDraftStoreOptions,
): MemoryProjectRecoveryDraftStore {
  return new MemoryProjectRecoveryDraftStore(options)
}

export function createIndexedDBProjectRecoveryDraftStore(
  options?: IndexedDBProjectRecoveryDraftStoreOptions,
): IndexedDBProjectRecoveryDraftStore {
  return new IndexedDBProjectRecoveryDraftStore(options)
}
