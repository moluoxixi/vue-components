import type {
  ProjectChangeSet,
  ProjectDocument,
  ReadonlyProjectDocument,
  RegistryLock,
} from '@moluoxixi/config-form-model'
import type {
  StoredProjectEntity,
  StoredProjectSnapshotManifest,
} from './project-document-repository-indexed-db'
import {
  assertProjectDocument,
  ProjectRepositoryError,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import {
  createSnapshotManifest,
  isStoredRecord,
  loadStoredProjectSnapshot,
  parseSnapshotManifest,
  readCurrentStoredProjectSnapshot,
  semanticChecksum,
} from './project-document-repository-indexed-db'

const DRAFT_STORAGE_VERSION = 1 as const
const DRAFT_PREFIX = 'project-recovery-draft:'

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

interface StoredRecoveryDraftManifest {
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
  storageSchemaVersion: typeof DRAFT_STORAGE_VERSION
  updatedAt: string
}

type StoredDraftValue = StoredProjectEntity | StoredRecoveryDraftManifest

export interface MemoryProjectRecoveryDraftStoreOptions {
  now?: () => string
}

export interface IndexedDBProjectRecoveryDraftStoreOptions {
  dbName?: string
  now?: () => string
  storeName?: string
}

function encoded(value: string): string {
  return encodeURIComponent(value)
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
  kind: 'page' | 'resource',
  id: string,
  checksum: string,
): string {
  return `${draftStoragePrefix(projectId, draftId)}${kind}:${encoded(id)}:${editVersion}:${encoded(checksum)}`
}

function manifestPayload(
  manifest: Omit<StoredRecoveryDraftManifest, 'checksum'>,
): unknown {
  return {
    baseRepositoryRevision: manifest.baseRepositoryRevision,
    changeSet: manifest.changeSet,
    contentHash: manifest.contentHash,
    createdAt: manifest.createdAt,
    draftId: manifest.draftId,
    editVersion: manifest.editVersion,
    projectId: manifest.projectId,
    registryLock: manifest.registryLock,
    sessionId: manifest.sessionId,
    snapshot: manifest.snapshot,
    storageSchemaVersion: manifest.storageSchemaVersion,
    updatedAt: manifest.updatedAt,
  }
}

function createManifest(
  capture: ProjectRecoveryDraftCapture,
  snapshot: StoredProjectSnapshotManifest,
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
    projectId: capture.projectId,
    registryLock: structuredClone(capture.registryLock),
    sessionId: capture.sessionId,
    snapshot,
    storageSchemaVersion: DRAFT_STORAGE_VERSION,
    updatedAt,
  }
  return { ...payload, checksum: semanticChecksum(payload) }
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function parseChangeSet(input: unknown): ProjectChangeSet {
  if (!isStoredRecord(input)
    || typeof input.project !== 'boolean'
    || !Array.isArray(input.pageIds)
    || !input.pageIds.every(id => typeof id === 'string')
    || !Array.isArray(input.nodeIds)
    || !input.nodeIds.every(id => typeof id === 'string')
    || !Array.isArray(input.nodeChanges)) {
    corrupt('Stored recovery draft change set is invalid.')
  }
  return structuredClone(input) as unknown as ProjectChangeSet
}

function parseManifest(input: unknown): StoredRecoveryDraftManifest {
  if (!isStoredRecord(input)
    || input.storageSchemaVersion !== DRAFT_STORAGE_VERSION
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
    || !isStoredRecord(input.registryLock)) {
    corrupt('Stored recovery draft manifest is invalid.')
  }
  const candidate: StoredRecoveryDraftManifest = {
    baseRepositoryRevision: Number(input.baseRepositoryRevision),
    changeSet: parseChangeSet(input.changeSet),
    checksum: input.checksum,
    contentHash: input.contentHash,
    createdAt: input.createdAt,
    draftId: input.draftId,
    editVersion: Number(input.editVersion),
    projectId: input.projectId,
    registryLock: structuredClone(input.registryLock) as unknown as RegistryLock,
    sessionId: input.sessionId,
    snapshot: parseSnapshotManifest(input.snapshot),
    storageSchemaVersion: DRAFT_STORAGE_VERSION,
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

function summary(manifest: StoredRecoveryDraftManifest): ProjectRecoveryDraftSummary {
  return {
    baseRepositoryRevision: manifest.baseRepositoryRevision,
    changedNodeCount: manifest.changeSet.nodeIds.length,
    changedPageIds: [...manifest.changeSet.pageIds],
    contentHash: manifest.contentHash,
    createdAt: manifest.createdAt,
    draftId: manifest.draftId,
    editVersion: manifest.editVersion,
    projectId: manifest.projectId,
    sessionId: manifest.sessionId,
    updatedAt: manifest.updatedAt,
  }
}

function assertCapture(capture: ProjectRecoveryDraftCapture): ProjectRecoveryDraftCapture {
  const draftId = capture.draftId.trim()
  const sessionId = capture.sessionId.trim()
  if (!draftId || !sessionId || capture.projectId !== capture.document.id)
    throw new TypeError('Recovery draft identity is invalid.')
  if (!Number.isInteger(capture.baseRepositoryRevision) || capture.baseRepositoryRevision < 0
    || !Number.isInteger(capture.editVersion) || capture.editVersion < 0) {
    throw new TypeError('Recovery draft revisions must be non-negative integers.')
  }
  const document = assertProjectDocument(capture.document)
  if (semanticChecksum(document.registryLock) !== semanticChecksum(capture.registryLock))
    throw new TypeError('Recovery draft Registry lock does not match the document.')
  return { ...capture, document, draftId, sessionId }
}

function cloneDraft(draft: ProjectRecoveryDraft): ProjectRecoveryDraft {
  return {
    ...structuredClone(draft),
    document: assertProjectDocument(draft.document),
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
    await Promise.resolve()
    const capture = assertCapture(input)
    const current = this.drafts.get(capture.draftId)
    if (current && current.editVersion > capture.editVersion)
      return summaryFromDraft(current)
    const updatedAt = this.now()
    const payload = {
      ...capture,
      createdAt: current?.createdAt ?? updatedAt,
      document: assertProjectDocument(capture.document),
      updatedAt,
    }
    const draft: ProjectRecoveryDraft = {
      ...payload,
      checksum: semanticChecksum(payload),
    }
    this.drafts.set(capture.draftId, cloneDraft(draft))
    return summaryFromDraft(draft)
  }

  async get(draftId: string): Promise<ProjectRecoveryDraft | undefined> {
    const draft = this.drafts.get(draftId)
    return draft ? cloneDraft(draft) : undefined
  }

  async list(projectId?: string): Promise<ProjectRecoveryDraftSummary[]> {
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
    changedNodeCount: draft.changeSet.nodeIds.length,
    changedPageIds: [...draft.changeSet.pageIds],
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
  private readonly now: () => string
  private readonly storage: IndexDBStorage

  constructor(options: IndexedDBProjectRecoveryDraftStoreOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString())
    this.storage = new IndexDBStorage({
      dbName: options.dbName ?? 'moluoxixi-config-form-workbench',
      storeName: options.storeName ?? 'workspace-projects',
    })
  }

  async open(): Promise<void> {
    await this.storage.length()
  }

  async put(input: ProjectRecoveryDraftCapture): Promise<ProjectRecoveryDraftSummary> {
    await Promise.resolve()
    const capture = assertCapture(input)
    const manifestKey = draftManifestKey(capture.projectId, capture.draftId)
    const preliminaryInput = await this.storage.getItem<StoredDraftValue>(manifestKey)
    const preliminary = preliminaryInput === null ? undefined : parseManifest(preliminaryInput)
    const updatedAt = this.now()
    const project = {
      document: assertProjectDocument(capture.document),
      repositoryRevision: capture.baseRepositoryRevision,
      entityRevisions: { manifest: capture.baseRepositoryRevision, pages: {}, resources: {} },
      createdAt: preliminary?.createdAt ?? updatedAt,
      updatedAt,
    }
    const formalSnapshot = preliminary
      ? undefined
      : await readCurrentStoredProjectSnapshot(this.storage, capture.projectId)
    const reusableSnapshot = preliminary?.snapshot
      ?? (formalSnapshot?.project.repositoryRevision === capture.baseRepositoryRevision
        ? formalSnapshot
        : undefined)
    const build = createSnapshotManifest(
      project,
      reusableSnapshot,
      (kind, id, _revision, checksum) => draftEntityKey(
        capture.projectId,
        capture.draftId,
        capture.editVersion,
        kind,
        id,
        checksum,
      ),
    )
    const manifest = createManifest(capture, build.snapshot, project.createdAt, updatedAt)
    const keys = [manifestKey, ...build.entityKeys]
    let accepted = manifest
    await this.storage.updateItems<StoredDraftValue>(keys, (values) => {
      const currentInput = values.get(manifestKey)
      const current = currentInput === null ? undefined : parseManifest(currentInput)
      if (current && current.editVersion > capture.editVersion) {
        accepted = current
        return []
      }
      return [
        { key: manifestKey, value: manifest },
        ...build.entities.map((entity, index) => ({ key: build.entityKeys[index]!, value: entity })),
      ]
    })
    return summary(accepted)
  }

  async get(draftId: string): Promise<ProjectRecoveryDraft | undefined> {
    const keys = (await this.storage.keys()).filter(key =>
      key.startsWith(DRAFT_PREFIX)
      && key.endsWith(`:${encoded(draftId)}:manifest`))
    if (keys.length === 0)
      return undefined
    if (keys.length > 1)
      corrupt(`Recovery draft id is ambiguous: ${draftId}`)
    const input = await this.storage.getItem<StoredDraftValue>(keys[0]!)
    if (input === null)
      return undefined
    const manifest = parseManifest(input)
    const project = await loadStoredProjectSnapshot(this.storage, manifest.snapshot)
    if (semanticChecksum(project.document.registryLock) !== semanticChecksum(manifest.registryLock))
      corrupt(`Recovery draft Registry lock mismatch: ${draftId}`)
    return {
      baseRepositoryRevision: manifest.baseRepositoryRevision,
      changeSet: structuredClone(manifest.changeSet),
      checksum: manifest.checksum,
      contentHash: manifest.contentHash,
      createdAt: manifest.createdAt,
      document: project.document,
      draftId: manifest.draftId,
      editVersion: manifest.editVersion,
      projectId: manifest.projectId,
      registryLock: structuredClone(manifest.registryLock),
      sessionId: manifest.sessionId,
      updatedAt: manifest.updatedAt,
    }
  }

  async list(projectId?: string): Promise<ProjectRecoveryDraftSummary[]> {
    const keys = (await this.storage.keys()).filter(key =>
      key.startsWith(DRAFT_PREFIX) && key.endsWith(':manifest'))
    const values = await this.storage.getItems<StoredDraftValue>(keys)
    return keys.flatMap((key) => {
      const value = values[key]
      if (value === null)
        return []
      const manifest = parseManifest(value)
      return projectId && manifest.projectId !== projectId ? [] : [summary(manifest)]
    }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async delete(draftId: string): Promise<void> {
    const allKeys = await this.storage.keys()
    const suffix = `:${encoded(draftId)}:`
    const keys = allKeys.filter(key => key.startsWith(DRAFT_PREFIX) && key.includes(suffix))
    if (keys.length === 0)
      return
    await this.storage.updateItems<StoredDraftValue>(keys, () =>
      keys.map(key => ({ key, value: null })))
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
