import type {
  PersistedProjectEnvelope,
  ProjectDocument,
  ProjectEmbeddedResourceRead,
  ProjectEmbeddedResourceWrite,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
  ProjectRepositoryCreateInput,
  ProjectResource,
  ProjectSummary,
  ProjectVersionLabelInput,
  ProjectVersionRetentionPolicy,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type {
  IndexedDBProjectRepositoryOptions,
  StoredProjectManifest,
  StoredProjectResourceBytes,
  StoredProjectSnapshotManifest,
  StoredProjectValue,
} from '../types'
import {
  assertProjectCommitMetadata,
  assertProjectDocument,
  assertProjectRepositorySeed,
  createMemoryProjectRepository,
  getProjectRepositoryCommitChecksum,
  ProjectRepositoryError,
  summarizePersistedProject,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'
import { readItemsByPrefix, updateItemsByPrefix } from './indexed-db-prefix-transaction'
import {
  assertFormalSnapshotStorageIdentity,
  createEnvelope,
  createSnapshotManifest,
  createStoredManifest,
  createStoredVersion,
  isStoredRecord,
  loadStoredProjectSnapshot,
  loadStoredProjectSnapshotFromValues,
  parseStoredEntity,
  parseStoredManifest,
  parseStoredResourceBytes,
  resourceBytesKeyForEntity,
  snapshotReferenceKeys,
  versionSummary,
} from './indexed-db-project-codec'
import {
  isProjectManifestStorageKey,
  projectIdFromManifestStorageKey,
  projectManifestKey,
  projectRecoveryStoragePrefix,
  projectResourceBytesKey,
  projectStoragePrefix,
} from './indexed-db-project-keys'
import { retainedVersions, validateRetentionPolicy } from './indexed-db-project-retention'
import { cloneEmbeddedResourceWrites, validateEmbeddedResourceWrites } from './project-resource-bytes'

export {
  createSnapshotManifest,
  isStoredRecord,
  loadStoredProjectSnapshot,
  parseSnapshotManifest,
  parseStoredEntity,
  parseStoredResourceBytes,
  readCurrentStoredProjectSnapshot,
  semanticChecksum,
  snapshotReferenceKeys,
} from './indexed-db-project-codec'
export {
  projectDatasetKey,
  projectManifestKey,
  projectResourceBytesKey,
  projectResourceKey,
  projectSurfaceKey,
} from './indexed-db-project-keys'

function invalidCommit(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_INVALID_COMMIT', message)
}

function corrupt(message: string): never {
  throw new ProjectRepositoryError('PROJECT_REPOSITORY_CORRUPT', message)
}

function embeddedResources(document: ProjectDocument): Array<Extract<ProjectResource, { kind: 'embedded' }>> {
  return Object.values(document.resources)
    .filter((resource): resource is Extract<ProjectResource, { kind: 'embedded' }> =>
      resource.kind === 'embedded')
    .sort((left, right) => left.id.localeCompare(right.id))
}

function storedBytes(write: ProjectEmbeddedResourceWrite, projectId: string): StoredProjectResourceBytes {
  return {
    byteLength: write.bytes.byteLength,
    bytes: new Uint8Array(write.bytes),
    contentHash: write.contentHash,
    kind: 'resource-bytes',
    projectId,
    resourceId: write.resourceId,
    version: 4,
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength
    && left.every((byte, index) => byte === right[index])
}

function currentBytesMatchValidated(
  input: unknown,
  validated: StoredProjectResourceBytes,
): boolean {
  return isStoredRecord(input)
    && Object.keys(input).length === 7
    && input.version === 4
    && input.kind === 'resource-bytes'
    && input.projectId === validated.projectId
    && input.resourceId === validated.resourceId
    && input.contentHash === validated.contentHash
    && input.byteLength === validated.byteLength
    && input.bytes instanceof Uint8Array
    && sameBytes(input.bytes, validated.bytes)
}

function uniqueSnapshots(manifest: StoredProjectManifest): StoredProjectSnapshotManifest[] {
  const byChecksum = new Map<string, StoredProjectSnapshotManifest>()
  const add = (snapshot: StoredProjectSnapshotManifest) => byChecksum.set(snapshot.checksum, snapshot)
  add(manifest.snapshot)
  manifest.receipts.forEach(receipt => add(receipt.snapshot))
  manifest.versions.forEach(version => add(version.snapshot))
  return [...byChecksum.values()]
}

export class IndexedDBProjectRepository implements ProjectRepository {
  readonly persistence = 'durable' as const
  private readonly dbName: string
  private readonly now: () => string
  private readonly receiptLimit: number
  private readonly storage: IndexDBStorage
  private readonly storeName: string

  constructor(options: IndexedDBProjectRepositoryOptions) {
    this.dbName = options.dbName ?? 'moluoxixi-config-form-workbench'
    this.receiptLimit = options.receiptLimit ?? 256
    this.now = options.now ?? (() => new Date().toISOString())
    this.storeName = options.storeName ?? 'workspace-projects'
    if (!Number.isInteger(this.receiptLimit) || this.receiptLimit < 1)
      throw new RangeError('Project repository receipt limit must be a positive integer.')
    this.storage = new IndexDBStorage({
      dbName: this.dbName,
      storeName: this.storeName,
    })
  }

  async open(): Promise<void> {
    await this.storage.length()
  }

  private async ensureManifest(id: string): Promise<StoredProjectManifest | undefined> {
    const input = await this.storage.getItem<StoredProjectValue>(projectManifestKey(id))
    if (input === null)
      return undefined
    const manifest = parseStoredManifest(input)
    uniqueSnapshots(manifest).forEach(snapshot =>
      assertFormalSnapshotStorageIdentity(snapshot, id))
    return manifest
  }

  private async validateSnapshotBytes(
    project: PersistedProjectEnvelope,
  ): Promise<void> {
    const resources = embeddedResources(project.document)
    if (resources.length === 0)
      return
    const keys = resources.map(resource =>
      projectResourceBytesKey(project.document.id, resource.id, resource.contentHash))
    const values = await this.storage.getItems<StoredProjectValue>(keys)
    await Promise.all(resources.map(async (resource, index) => {
      const input = values[keys[index]!]
      if (input === null)
        corrupt(`Stored Resource bytes are missing: ${resource.id}`)
      const record = await parseStoredResourceBytes(input, {
        projectId: project.document.id,
        resourceId: resource.id,
        contentHash: resource.contentHash,
      })
      if (record.byteLength !== resource.byteLength)
        corrupt(`Stored Resource byte length does not match metadata: ${resource.id}`)
    }))
  }

  private async loadSnapshot(
    snapshot: StoredProjectSnapshotManifest,
  ): Promise<PersistedProjectEnvelope> {
    const project = await loadStoredProjectSnapshot(this.storage, snapshot)
    await this.validateSnapshotBytes(project)
    return project
  }

  async get(id: string): Promise<PersistedProjectEnvelope | undefined> {
    const manifest = await this.ensureManifest(id)
    return manifest ? await this.loadSnapshot(manifest.snapshot) : undefined
  }

  async list(): Promise<ProjectSummary[]> {
    const ids = (await this.storage.keys())
      .filter(key => isProjectManifestStorageKey(key))
      .map(key => projectIdFromManifestStorageKey(key))
    const projects = await Promise.all(ids.map(id => this.get(id)))
    return projects.flatMap(project => project ? [summarizePersistedProject(project)] : [])
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.name.localeCompare(right.name))
  }

  async create(input: ProjectRepositoryCreateInput): Promise<PersistedProjectEnvelope> {
    const document = assertProjectDocument(input.document)
    let embeddedContents: ProjectEmbeddedResourceWrite[]
    try {
      embeddedContents = await validateEmbeddedResourceWrites(document, input.embeddedContents, true)
    }
    catch (error) {
      invalidCommit(error instanceof Error ? error.message : String(error))
    }
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
    const byteEntries = embeddedContents.map(write => ({
      key: projectResourceBytesKey(document.id, write.resourceId, write.contentHash),
      value: storedBytes(write, document.id),
    }))
    const keys = [manifestKey, ...build.entityKeys, ...byteEntries.map(entry => entry.key)]
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
        ...byteEntries,
      ]
    })
    return await this.loadSnapshot(build.snapshot)
  }

  async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
    const commandId = input.commandId.trim()
    if (!commandId)
      invalidCommit('Repository commits require a non-empty command id.')
    const document = assertProjectDocument(input.document)
    const metadata = assertProjectCommitMetadata(input.metadata)
    const captured: ProjectRepositoryCommitInput = {
      commandId,
      document,
      embeddedWrites: cloneEmbeddedResourceWrites(input.embeddedWrites ?? []),
      expectedRepositoryRevision: input.expectedRepositoryRevision,
      id: input.id,
      metadata,
    }
    if (document.id !== captured.id)
      invalidCommit('Repository commit id does not match the project document.')

    let embeddedWrites: ProjectEmbeddedResourceWrite[]
    try {
      embeddedWrites = await validateEmbeddedResourceWrites(
        document,
        captured.embeddedWrites ?? [],
        false,
      )
    }
    catch (error) {
      invalidCommit(error instanceof Error ? error.message : String(error))
    }
    const stagedByKey = new Map(embeddedWrites.map(write => [
      projectResourceBytesKey(document.id, write.resourceId, write.contentHash),
      storedBytes(write, document.id),
    ]))
    const requiredResources = embeddedResources(document)
    const requiredKeys = requiredResources.map(resource =>
      projectResourceBytesKey(document.id, resource.id, resource.contentHash))
    const existingInputs = await this.storage.getItems<StoredProjectValue>(requiredKeys)
    const validatedExisting = new Map<string, StoredProjectResourceBytes>()
    await Promise.all(requiredResources.map(async (resource, index) => {
      const key = requiredKeys[index]!
      const existing = existingInputs[key]
      if (existing === null)
        return
      const parsed = await parseStoredResourceBytes(existing, {
        projectId: document.id,
        resourceId: resource.id,
        contentHash: resource.contentHash,
      })
      if (parsed.byteLength !== resource.byteLength)
        corrupt(`Stored Resource byte length does not match metadata: ${resource.id}`)
      validatedExisting.set(key, parsed)
    }))

    const manifestKey = projectManifestKey(captured.id)
    const preliminary = await this.ensureManifest(captured.id)
    if (!preliminary) {
      throw new ProjectRepositoryError(
        'PROJECT_REPOSITORY_NOT_FOUND',
        `Project does not exist: ${captured.id}`,
      )
    }
    const project = createEnvelope(
      document,
      captured.expectedRepositoryRevision + 1,
      preliminary.snapshot.project.createdAt,
      this.now(),
    )
    const candidateBuild = createSnapshotManifest(project, preliminary.snapshot)
    const keys = [...new Set([manifestKey, ...candidateBuild.entityKeys, ...requiredKeys])]
    const payloadChecksum = getProjectRepositoryCommitChecksum(captured)
    let targetSnapshot: StoredProjectSnapshotManifest | undefined
    let replayed = false

    await this.storage.updateItems<StoredProjectValue>(keys, (currentValues) => {
      const manifestInput = currentValues.get(manifestKey)
      if (manifestInput === null) {
        throw new ProjectRepositoryError(
          'PROJECT_REPOSITORY_NOT_FOUND',
          `Project does not exist: ${captured.id}`,
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
      if (current.snapshot.project.repositoryRevision !== captured.expectedRepositoryRevision) {
        throw new ProjectRepositoryError(
          'PROJECT_REVISION_CONFLICT',
          `Expected repository revision ${captured.expectedRepositoryRevision}, but repository has ${current.snapshot.project.repositoryRevision}.`,
        )
      }
      if (document.id !== current.snapshot.project.id)
        invalidCommit('Repository commits cannot change project identity.')

      requiredResources.forEach((resource, index) => {
        const key = requiredKeys[index]!
        const currentBytes = currentValues.get(key)
        const validated = validatedExisting.get(key)
        if (currentBytes !== null && (!validated || !currentBytesMatchValidated(currentBytes, validated)))
          corrupt(`Stored Resource bytes changed during commit: ${resource.id}`)
        if (currentBytes === null && !stagedByKey.has(key))
          invalidCommit(`Embedded Resource bytes are missing: ${resource.id}`)
      })

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
        ...[...stagedByKey].map(([key, value]) => ({ key, value })),
      ]
    })

    if (!targetSnapshot)
      corrupt('Repository commit produced no snapshot.')
    return { project: await this.loadSnapshot(targetSnapshot), replayed }
  }

  async readEmbedded(input: ProjectEmbeddedResourceRead): Promise<Uint8Array | undefined> {
    const key = projectResourceBytesKey(input.projectId, input.resourceId, input.contentHash)
    const values = await readItemsByPrefix<StoredProjectValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [projectStoragePrefix(input.projectId)],
    })
    const manifestInput = values.get(projectManifestKey(input.projectId))
    const manifest = manifestInput === undefined ? undefined : parseStoredManifest(manifestInput)
    if (manifest)
      uniqueSnapshots(manifest).forEach(snapshot => assertFormalSnapshotStorageIdentity(snapshot, input.projectId))
    const resources = manifest
      ? uniqueSnapshots(manifest).flatMap((snapshot) => {
          const reference = snapshot.resources[input.resourceId]
          if (!reference)
            return []
          const entityInput = values.get(reference.key)
          if (entityInput === undefined)
            corrupt(`Stored resource entity is missing: ${reference.key}`)
          const entity = parseStoredEntity(entityInput, reference, 'resource', input.resourceId)
          if (entity.projectId !== snapshot.project.id)
            corrupt(`Stored resource entity belongs to another project: ${reference.key}`)
          return [entity.value as ProjectResource]
        })
      : []
    const value = values.get(key)
    if (value !== undefined) {
      const record = await parseStoredResourceBytes(value, input)
      resources.forEach((resource) => {
        if (resource.kind === 'embedded'
          && resource.contentHash === input.contentHash
          && resource.byteLength !== record.byteLength) {
          corrupt(`Stored Resource byte length does not match metadata: ${input.resourceId}`)
        }
      })
      return new Uint8Array(record.bytes)
    }

    if (!manifest)
      return undefined
    for (const resource of resources) {
      if (resource.kind === 'embedded' && resource.contentHash === input.contentHash)
        corrupt(`Stored Resource bytes are missing: ${input.resourceId}`)
    }
    return undefined
  }

  async getVersion(
    projectId: string,
    revision: number,
  ): Promise<PersistedProjectEnvelope | undefined> {
    const manifest = await this.ensureManifest(projectId)
    const version = manifest?.versions.find(candidate => candidate.repositoryRevision === revision)
    return version ? await this.loadSnapshot(version.snapshot) : undefined
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
    await updateItemsByPrefix<StoredProjectValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [projectStoragePrefix(projectId)],
    }, (values) => {
      const currentInput = values.get(manifestKey)
      if (currentInput === null || currentInput === undefined)
        return []
      const candidates = [...values.keys()].filter(key => key !== manifestKey)
      const current = parseStoredManifest(currentInput)
      const versions = retainedVersions(current, policy)
      const snapshots = [
        current.snapshot,
        ...current.receipts.map(receipt => receipt.snapshot),
        ...versions.map(version => version.snapshot),
      ]
      const reachable = new Set<string>()
      snapshots.forEach((snapshot) => {
        assertFormalSnapshotStorageIdentity(snapshot, projectId)
        snapshotReferenceKeys(snapshot).forEach(key => reachable.add(key))
        const project = loadStoredProjectSnapshotFromValues(values, snapshot)
        Object.values(project.document.resources).forEach((resource) => {
          const key = resourceBytesKeyForEntity(projectId, resource)
          if (key)
            reachable.add(key)
        })
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
    await updateItemsByPrefix<StoredProjectValue>({
      dbName: this.dbName,
      storeName: this.storeName,
      prefixes: [projectStoragePrefix(id), projectRecoveryStoragePrefix(id)],
    }, values => [...values.keys()].map(key => ({ key, value: null })))
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
