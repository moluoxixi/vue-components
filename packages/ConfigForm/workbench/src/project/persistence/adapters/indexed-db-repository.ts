import type {
  PersistedProjectEnvelope,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
  ProjectRepositoryCreateInput,
  ProjectSummary,
  ProjectVersionLabelInput,
  ProjectVersionRetentionPolicy,
  ProjectVersionSummary,
} from '@moluoxixi/config-form-model'
import type {
  IndexedDBProjectRepositoryOptions,
  StoredProjectManifest,
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
} from '@moluoxixi/config-form-model'
import { IndexDBStorage, IndexedDBManager } from '@moluoxixi/indexed-db'
import {
  createEnvelope,
  createSnapshotManifest,
  createStoredManifest,
  createStoredVersion,
  isStoredRecord,
  loadStoredProjectSnapshot,
  parseSnapshotManifest,
  parseStoredManifest,
  snapshotReferenceKeys,
  versionSummary,
} from './indexed-db-project-codec'
import {
  isProjectManifestStorageKey,
  projectIdFromManifestStorageKey,
  projectManifestKey,
  projectStoragePrefix,
} from './indexed-db-project-keys'
import { retainedVersions, validateRetentionPolicy } from './indexed-db-project-retention'

export {
  createSnapshotManifest,
  isStoredRecord,
  loadStoredProjectSnapshot,
  parseSnapshotManifest,
  parseStoredEntity,
  readCurrentStoredProjectSnapshot,
  semanticChecksum,
  snapshotReferenceKeys,
} from './indexed-db-project-codec'
export { projectManifestKey } from './indexed-db-project-keys'

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
      .filter(key => isProjectManifestStorageKey(key))
    const manifests = await Promise.all(keys.map(async (key) => {
      return await this.ensureManifest(projectIdFromManifestStorageKey(key))
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
