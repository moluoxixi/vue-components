import type {
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
  ProjectRepositoryCommitInput,
} from '@moluoxixi/config-form-model'
import type {
  StoredProjectEntity,
  StoredProjectManifest,
  StoredProjectResourceBytes,
  StoredProjectSnapshotManifest,
} from '../persistence'
import {
  createMemoryProjectRepository,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createIndexedDBProjectRecoveryDraftStore,
  createIndexedDBProjectRepository,
  parseStoredEntity,
  projectDatasetKey,
  projectManifestKey,
  projectResourceBytesKey,
  projectResourceKey,
  projectSurfaceKey,
  readCurrentStoredProjectSnapshot,
  semanticChecksum,
} from '../persistence'
import 'fake-indexeddb/auto'

const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(closeable => closeable.close())
})

function repositoryOptions(dbName: string) {
  return { dbName }
}

function projectDocument(): ProjectDocument {
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Fixture project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: {
          version: SURFACE_GRAPH_VERSION,
          props: {},
          form: {},
          root: [],
          nodesById: {},
        },
      },
    },
    datasetOrder: ['countries'],
    datasetsById: {
      countries: {
        id: 'countries',
        name: 'Countries',
        rows: [{ code: 'CN', label: 'China' }],
      },
    },
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: {
      adapter: 'element-plus',
      version: '1.0.0',
      fingerprint: registryLockFingerprint({}),
      components: {},
    },
    settings: {},
  }
}

function renameSurface(document: ProjectDocument, name: string): ProjectDocument {
  const next = structuredClone(document)
  next.surfacesById.home!.name = name
  return next
}

async function contentHash(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer))
  return `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

async function withEmbeddedResource(
  document: ProjectDocument,
  bytes: Uint8Array,
  resourceId = 'logo',
): Promise<{ document: ProjectDocument, write: ProjectEmbeddedResourceWrite }> {
  const hash = await contentHash(bytes)
  const next = structuredClone(document)
  next.resources[resourceId] = {
    id: resourceId,
    name: 'Logo',
    kind: 'embedded',
    fileName: 'logo.png',
    mediaType: 'image/png',
    byteLength: bytes.byteLength,
    contentHash: hash,
  }
  return {
    document: next,
    write: { resourceId, contentHash: hash, bytes: new Uint8Array(bytes) },
  }
}

function emptyChangeSet() {
  return {
    project: false,
    surfaceIds: [] as string[],
    datasetIds: [] as string[],
    resourceIds: [] as string[],
    nodeChanges: [],
  }
}

function replaceResourceChecksum(
  snapshot: StoredProjectSnapshotManifest,
  resourceId: string,
  checksum: string,
): StoredProjectSnapshotManifest {
  const reference = snapshot.resources[resourceId]
  if (!reference)
    throw new Error(`Missing Resource reference: ${resourceId}`)
  const payload = {
    datasets: snapshot.datasets,
    project: snapshot.project,
    resources: {
      ...snapshot.resources,
      [resourceId]: { ...reference, checksum },
    },
    surfaces: snapshot.surfaces,
  }
  return { ...payload, checksum: semanticChecksum(payload) }
}

function replaceManifestResourceChecksum(
  manifest: StoredProjectManifest,
  resourceId: string,
  checksum: string,
): StoredProjectManifest {
  const payload = {
    receipts: manifest.receipts.map(receipt => ({
      ...receipt,
      snapshot: replaceResourceChecksum(receipt.snapshot, resourceId, checksum),
    })),
    snapshot: replaceResourceChecksum(manifest.snapshot, resourceId, checksum),
    version: manifest.version,
    versions: manifest.versions.map(version => ({
      ...version,
      snapshot: replaceResourceChecksum(version.snapshot, resourceId, checksum),
    })),
  }
  return { ...payload, checksum: semanticChecksum(payload) }
}

describe('indexedDBProjectRepository v4', () => {
  it('stores Surface, Dataset, and Resource entities under v4 keys', async () => {
    const dbName = `project-document-v4-entities-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({
      document: embedded.document,
      embeddedContents: [embedded.write],
    })

    await expect(repository.get(created.document.id)).resolves.toEqual(created)
    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: created.document.id, repositoryRevision: 0 }),
    ])

    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const keys = await storage.keys()
    expect(keys).toEqual(expect.arrayContaining([
      projectManifestKey('project'),
      projectSurfaceKey('project', 'home', 0),
      projectDatasetKey('project', 'countries', 0),
      projectResourceKey('project', 'logo', 0),
      projectResourceBytesKey('project', 'logo', embedded.write.contentHash),
    ]))
    expect(keys.some(key => key.includes(':page:'))).toBe(false)
    const snapshot = await readCurrentStoredProjectSnapshot(storage, 'project')
    expect(snapshot).toMatchObject({
      project: { homeSurfaceId: 'home', surfaceOrder: ['home'], datasetOrder: ['countries'] },
      surfaces: { home: expect.any(Object) },
      datasets: { countries: expect.any(Object) },
      resources: { logo: expect.any(Object) },
    })
    expect(parseStoredEntity(
      await storage.getItem(snapshot!.surfaces.home!.key),
      snapshot!.surfaces.home!,
      'surface',
      'home',
    )).toMatchObject({ id: 'home', kind: 'surface', projectId: 'project', version: 4 })
  })

  it('requires an exact embedded metadata/bytes bijection on create', async () => {
    const dbName = `project-document-v4-create-bijection-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))

    await expect(repository.create({ document: embedded.document, embeddedContents: [] }))
      .rejects
      .toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    await expect(repository.create({
      document: projectDocument(),
      embeddedContents: [embedded.write],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    await expect(repository.get('project')).resolves.toBeUndefined()
  })

  it('rejects duplicate, URL, hash, and length-invalid embedded writes before publishing', async () => {
    const dbName = `project-document-v4-invalid-writes-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(repository, storage)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))

    await expect(repository.create({
      document: embedded.document,
      embeddedContents: [embedded.write, { ...embedded.write, bytes: new Uint8Array(embedded.write.bytes) }],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })

    const urlDocument = projectDocument()
    urlDocument.resources.logo = {
      id: 'logo',
      name: 'Logo',
      kind: 'url',
      url: '/assets/logo.png',
      mediaType: 'image/png',
    }
    await expect(repository.create({
      document: urlDocument,
      embeddedContents: [embedded.write],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })

    await expect(repository.create({
      document: embedded.document,
      embeddedContents: [{
        ...embedded.write,
        contentHash: `sha256:${'0'.repeat(64)}`,
      }],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })

    const wrongLength = structuredClone(embedded.document)
    const resource = wrongLength.resources.logo
    if (!resource || resource.kind !== 'embedded')
      throw new Error('Expected embedded Resource fixture.')
    resource.byteLength += 1
    await expect(repository.create({
      document: wrongLength,
      embeddedContents: [embedded.write],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })

    await expect(storage.keys()).resolves.toEqual([])
  })

  it('validates SHA-256 and byteLength before publishing any record', async () => {
    const dbName = `project-document-v4-invalid-bytes-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const invalid = { ...embedded.write, bytes: new Uint8Array([1, 2, 4]) }

    await expect(repository.create({
      document: embedded.document,
      embeddedContents: [invalid],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    await expect(storage.keys()).resolves.toEqual([])
  })

  it('copies bytes on write and returns a fresh copy on every read', async () => {
    const dbName = `project-document-v4-copy-isolation-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const source = new Uint8Array([1, 2, 3])
    const embedded = await withEmbeddedResource(projectDocument(), source)
    await repository.create({ document: embedded.document, embeddedContents: [embedded.write] })
    source[0] = 9
    embedded.write.bytes[1] = 9

    const first = await repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: embedded.write.contentHash,
    })
    expect(first).toEqual(new Uint8Array([1, 2, 3]))
    first![0] = 8
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: embedded.write.contentHash,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it('reuses an existing exact hash without requiring another staged write', async () => {
    const dbName = `project-document-v4-exact-hash-reuse-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({
      document: embedded.document,
      embeddedContents: [embedded.write],
    })

    await expect(repository.commit({
      commandId: 'rename-with-existing-bytes',
      document: renameSurface(embedded.document, 'Landing'),
      expectedRepositoryRevision: created.repositoryRevision,
      id: embedded.document.id,
      metadata: { source: 'manual' },
    })).resolves.toMatchObject({
      replayed: false,
      project: {
        repositoryRevision: 1,
        document: { resources: { logo: { contentHash: embedded.write.contentHash } } },
      },
    })
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: embedded.write.contentHash,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it('commits metadata and replacement bytes atomically with CAS and receipt replay', async () => {
    const dbName = `project-document-v4-commit-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))
    const input = {
      commandId: 'replace-logo',
      document: renameSurface(second.document, 'Landing'),
      embeddedWrites: [second.write],
      expectedRepositoryRevision: created.repositoryRevision,
      id: first.document.id,
      metadata: { source: 'manual' as const },
    }

    const committed = await repository.commit(input)
    const replayed = await repository.commit(input)
    expect(committed).toMatchObject({ replayed: false, project: { repositoryRevision: 1 } })
    expect(replayed).toMatchObject({ replayed: true, project: { repositoryRevision: 1 } })
    expect(replayed.project).toEqual(committed.project)
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: second.write.contentHash,
    })).resolves.toEqual(new Uint8Array([4, 5, 6]))
  })

  it('captures commit inputs before yielding and rejects replay after caller mutation', async () => {
    const dbName = `project-document-v4-captured-input-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const created = await repository.create({ document: projectDocument(), embeddedContents: [] })
    const input: ProjectRepositoryCommitInput = {
      commandId: 'captured-input',
      document: renameSurface(created.document, 'Captured'),
      expectedRepositoryRevision: created.repositoryRevision,
      id: created.document.id,
      metadata: { source: 'manual' },
    }

    const pending = repository.commit(input)
    input.document.surfacesById.home!.name = 'Mutated after call'
    const committed = await pending

    expect(committed.project.document.surfacesById.home!.name).toBe('Captured')
    await expect(repository.commit(input)).rejects.toMatchObject({
      code: 'PROJECT_REPOSITORY_COMMAND_REUSED',
    })
  })

  it('keeps manifest and entity revisions in parity with the Memory Repository', async () => {
    const dbName = `project-document-v4-revision-parity-${sequence++}`
    const indexed = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const memory = createMemoryProjectRepository()
    closeables.push(indexed)
    await indexed.open()
    const source = projectDocument()
    const indexedCreated = await indexed.create({ document: source, embeddedContents: [] })
    const memoryCreated = await memory.create({ document: source, embeddedContents: [] })
    const surfaceOnly = renameSurface(source, 'Landing')

    const indexedSurface = await indexed.commit({
      commandId: 'surface-only',
      document: surfaceOnly,
      expectedRepositoryRevision: indexedCreated.repositoryRevision,
      id: source.id,
      metadata: { source: 'manual' },
    })
    const memorySurface = await memory.commit({
      commandId: 'surface-only',
      document: surfaceOnly,
      expectedRepositoryRevision: memoryCreated.repositoryRevision,
      id: source.id,
      metadata: { source: 'manual' },
    })
    expect(indexedSurface.project.entityRevisions).toEqual(memorySurface.project.entityRevisions)
    expect(indexedSurface.project.entityRevisions).toMatchObject({
      manifest: 0,
      surfaces: { home: 1 },
      datasets: { countries: 0 },
      resources: {},
    })

    const manifestOnly = structuredClone(surfaceOnly)
    manifestOnly.name = 'Renamed project'
    const indexedManifest = await indexed.commit({
      commandId: 'manifest-only',
      document: manifestOnly,
      expectedRepositoryRevision: indexedSurface.project.repositoryRevision,
      id: source.id,
      metadata: { source: 'manual' },
    })
    const memoryManifest = await memory.commit({
      commandId: 'manifest-only',
      document: manifestOnly,
      expectedRepositoryRevision: memorySurface.project.repositoryRevision,
      id: source.id,
      metadata: { source: 'manual' },
    })
    expect(indexedManifest.project.entityRevisions).toEqual(memoryManifest.project.entityRevisions)
    expect(indexedManifest.project.entityRevisions).toMatchObject({
      manifest: 2,
      surfaces: { home: 1 },
      datasets: { countries: 0 },
      resources: {},
    })
  })

  it('rejects a missing staged hash without advancing the manifest', async () => {
    const dbName = `project-document-v4-missing-stage-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))

    await expect(repository.commit({
      commandId: 'missing-logo-stage',
      document: second.document,
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    await expect(repository.get('project')).resolves.toEqual(created)
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: second.write.contentHash,
    })).resolves.toBeUndefined()
  })

  it('does not publish staged bytes for a CAS loser or reused command id', async () => {
    const dbName = `project-document-v4-staged-byte-isolation-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    const winner = await repository.commit({
      commandId: 'winner',
      document: renameSurface(first.document, 'Winner'),
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })
    const losing = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))

    await expect(repository.commit({
      commandId: 'loser',
      document: losing.document,
      embeddedWrites: [losing.write],
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' },
    })).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: losing.write.contentHash,
    })).resolves.toBeUndefined()

    const accepted = await withEmbeddedResource(winner.project.document, new Uint8Array([7, 8, 9]))
    const acceptedInput = {
      commandId: 'replace-after-winner',
      document: accepted.document,
      embeddedWrites: [accepted.write],
      expectedRepositoryRevision: winner.project.repositoryRevision,
      id: 'project',
      metadata: { source: 'manual' as const },
    }
    const committed = await repository.commit(acceptedInput)
    await expect(repository.commit(acceptedInput)).resolves.toMatchObject({ replayed: true })

    const reused = await withEmbeddedResource(committed.project.document, new Uint8Array([10, 11, 12]))
    await expect(repository.commit({
      ...acceptedInput,
      document: reused.document,
      embeddedWrites: [reused.write],
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_COMMAND_REUSED' })
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: reused.write.contentHash,
    })).resolves.toBeUndefined()
  })

  it('rolls back manifest, entities, and bytes when a transaction write fails', async () => {
    const dbName = `project-document-v4-abort-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))
    const originalPut = IDBObjectStore.prototype.put
    let putCount = 0
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      putCount += 1
      if (putCount === 2)
        throw new DOMException('Injected quota failure.', 'QuotaExceededError')
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key)
    })

    try {
      await expect(repository.commit({
        commandId: 'aborted-logo-stage',
        document: second.document,
        embeddedWrites: [second.write],
        expectedRepositoryRevision: created.repositoryRevision,
        id: 'project',
        metadata: { source: 'manual' },
      })).rejects.toThrow()
    }
    finally {
      putSpy.mockRestore()
    }

    await expect(repository.get('project')).resolves.toEqual(created)
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: second.write.contentHash,
    })).resolves.toBeUndefined()
  })

  it('fails closed when a published byte record is missing or damaged', async () => {
    const dbName = `project-document-v4-corrupt-bytes-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    await repository.create({ document: embedded.document, embeddedContents: [embedded.write] })
    const key = projectResourceBytesKey('project', 'logo', embedded.write.contentHash)
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    await storage.removeItem(key)

    await expect(repository.get('project')).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: embedded.write.contentHash,
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('rejects byte records with wrong version, identity, length, or raw SHA-256', async () => {
    const dbName = `project-document-v4-corrupt-byte-fields-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(repository, storage)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    await repository.create({ document: embedded.document, embeddedContents: [embedded.write] })
    const key = projectResourceBytesKey('project', 'logo', embedded.write.contentHash)
    const original = await storage.getItem<StoredProjectResourceBytes>(key)
    if (!original)
      throw new Error('Expected stored Resource bytes fixture.')
    const variants: unknown[] = [
      { ...original, version: 3 },
      { ...original, projectId: 'foreign-project' },
      { ...original, resourceId: 'foreign-resource' },
      { ...original, contentHash: `sha256:${'0'.repeat(64)}` },
      { ...original, byteLength: original.byteLength + 1 },
      { ...original, bytes: new Uint8Array([1, 2, 4]) },
    ]

    for (const variant of variants) {
      await storage.setItem(key, variant)
      await expect(repository.readEmbedded({
        projectId: 'project',
        resourceId: 'logo',
        contentHash: embedded.write.contentHash,
      })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
      await storage.setItem(key, original)
    }
  })

  it('rejects a byte record whose length disagrees with valid Resource metadata', async () => {
    const dbName = `project-document-v4-metadata-byte-length-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(repository, storage)
    await repository.open()
    const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    await repository.create({ document: embedded.document, embeddedContents: [embedded.write] })
    const snapshot = await readCurrentStoredProjectSnapshot(storage, 'project')
    if (!snapshot)
      throw new Error('Expected stored project snapshot fixture.')
    const reference = snapshot.resources.logo
    if (!reference)
      throw new Error('Expected stored Resource reference fixture.')
    const entity = await storage.getItem<StoredProjectEntity>(reference.key)
    const manifest = await storage.getItem<StoredProjectManifest>(projectManifestKey('project'))
    if (!entity || entity.kind !== 'resource' || !manifest)
      throw new Error('Expected stored embedded Resource entity fixture.')
    const resource = entity.value
    if (!('kind' in resource) || resource.kind !== 'embedded')
      throw new Error('Expected stored embedded Resource entity fixture.')
    const value = { ...resource, byteLength: resource.byteLength + 1 }
    const changedEntity: StoredProjectEntity = {
      ...entity,
      checksum: semanticChecksum(value),
      value,
    }
    const changedManifest = replaceManifestResourceChecksum(
      manifest,
      'logo',
      changedEntity.checksum,
    )
    await storage.setItems<StoredProjectEntity | StoredProjectManifest>([
      { key: reference.key, value: changedEntity },
      { key: projectManifestKey('project'), value: changedManifest },
    ])

    await expect(repository.get('project')).rejects.toMatchObject({
      code: 'PROJECT_REPOSITORY_CORRUPT',
    })
  })

  it('keeps historical hashes until formal version pruning makes them unreachable', async () => {
    const dbName = `project-document-v4-prune-bytes-${sequence++}`
    let now = '2026-01-01T00:00:00.000Z'
    const repository = createIndexedDBProjectRepository({ dbName, now: () => now, receiptLimit: 1 })
    closeables.push(repository)
    await repository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    now = '2026-01-02T00:00:00.000Z'
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))
    await repository.commit({
      commandId: 'replace-logo-for-prune',
      document: second.document,
      embeddedWrites: [second.write],
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })

    await expect(repository.getVersion('project', 0)).resolves.toMatchObject({
      document: { resources: { logo: { contentHash: first.write.contentHash } } },
    })
    await repository.pruneVersions('project', {
      keepDailyForDays: 0,
      keepLatestAutosaves: 0,
      now: '2026-03-01T00:00:00.000Z',
    })
    await expect(repository.getVersion('project', 0)).resolves.toBeUndefined()
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: first.write.contentHash,
    })).resolves.toBeUndefined()
    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: second.write.contentHash,
    })).resolves.toEqual(new Uint8Array([4, 5, 6]))
  })

  it('keeps byte hashes reachable from current, receipt, and labeled version roots', async () => {
    const receiptDbName = `project-document-v4-receipt-roots-${sequence++}`
    let receiptNow = '2026-01-01T00:00:00.000Z'
    const receiptRepository = createIndexedDBProjectRepository({
      dbName: receiptDbName,
      now: () => receiptNow,
      receiptLimit: 2,
    })
    closeables.push(receiptRepository)
    await receiptRepository.open()
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await receiptRepository.create({
      document: first.document,
      embeddedContents: [first.write],
    })
    receiptNow = '2026-01-02T00:00:00.000Z'
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))
    const secondCommit = await receiptRepository.commit({
      commandId: 'receipt-root-second',
      document: second.document,
      embeddedWrites: [second.write],
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })
    receiptNow = '2026-01-03T00:00:00.000Z'
    const third = await withEmbeddedResource(second.document, new Uint8Array([7, 8, 9]))
    await receiptRepository.commit({
      commandId: 'receipt-root-third',
      document: third.document,
      embeddedWrites: [third.write],
      expectedRepositoryRevision: secondCommit.project.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })
    await receiptRepository.pruneVersions('project', {
      keepDailyForDays: 0,
      keepLatestAutosaves: 0,
      now: '2026-03-01T00:00:00.000Z',
    })
    await expect(receiptRepository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: first.write.contentHash,
    })).resolves.toBeUndefined()
    await expect(receiptRepository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: second.write.contentHash,
    })).resolves.toEqual(new Uint8Array([4, 5, 6]))
    await expect(receiptRepository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: third.write.contentHash,
    })).resolves.toEqual(new Uint8Array([7, 8, 9]))

    const labelDbName = `project-document-v4-label-roots-${sequence++}`
    let labelNow = '2026-01-01T00:00:00.000Z'
    const labelRepository = createIndexedDBProjectRepository({
      dbName: labelDbName,
      now: () => labelNow,
      receiptLimit: 1,
    })
    closeables.push(labelRepository)
    await labelRepository.open()
    const labelFirst = await withEmbeddedResource(projectDocument(), new Uint8Array([10, 11, 12]))
    const labelCreated = await labelRepository.create({
      document: labelFirst.document,
      embeddedContents: [labelFirst.write],
    })
    labelNow = '2026-01-02T00:00:00.000Z'
    const labeled = await withEmbeddedResource(labelFirst.document, new Uint8Array([13, 14, 15]))
    const labeledCommit = await labelRepository.commit({
      commandId: 'label-root-second',
      document: labeled.document,
      embeddedWrites: [labeled.write],
      expectedRepositoryRevision: labelCreated.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })
    await labelRepository.setVersionLabel({
      projectId: 'project',
      revision: labeledCommit.project.repositoryRevision,
      label: 'keep-me',
      expectedRepositoryRevision: labeledCommit.project.repositoryRevision,
    })
    labelNow = '2026-01-03T00:00:00.000Z'
    const labelCurrent = await withEmbeddedResource(labeled.document, new Uint8Array([16, 17, 18]))
    await labelRepository.commit({
      commandId: 'label-root-third',
      document: labelCurrent.document,
      embeddedWrites: [labelCurrent.write],
      expectedRepositoryRevision: labeledCommit.project.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })
    await labelRepository.pruneVersions('project', {
      keepDailyForDays: 0,
      keepLatestAutosaves: 0,
      now: '2026-03-01T00:00:00.000Z',
    })
    await expect(labelRepository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: labeled.write.contentHash,
    })).resolves.toEqual(new Uint8Array([13, 14, 15]))
    await expect(labelRepository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: labelCurrent.write.contentHash,
    })).resolves.toEqual(new Uint8Array([16, 17, 18]))
  })

  it('does not treat Recovery Draft bytes as a formal prune root', async () => {
    const dbName = `project-document-v4-recovery-not-root-${sequence++}`
    let now = '2026-01-01T00:00:00.000Z'
    const repository = createIndexedDBProjectRepository({ dbName, now: () => now, receiptLimit: 1 })
    const drafts = createIndexedDBProjectRecoveryDraftStore({ dbName, now: () => now })
    closeables.push(repository, drafts)
    await Promise.all([repository.open(), drafts.open()])
    const first = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
    const created = await repository.create({ document: first.document, embeddedContents: [first.write] })
    await drafts.put({
      version: 2,
      baseRepositoryRevision: created.repositoryRevision,
      changeSet: emptyChangeSet(),
      contentHash: 'draft-old-hash',
      document: first.document,
      draftId: 'project:old',
      editVersion: 1,
      embeddedContents: [first.write],
      projectId: 'project',
      registryLock: first.document.registryLock,
      sessionId: 'old',
    })
    now = '2026-01-02T00:00:00.000Z'
    const second = await withEmbeddedResource(first.document, new Uint8Array([4, 5, 6]))
    await repository.commit({
      commandId: 'replace-formal-hash',
      document: second.document,
      embeddedWrites: [second.write],
      expectedRepositoryRevision: created.repositoryRevision,
      id: 'project',
      metadata: { source: 'autosave' },
    })
    await repository.pruneVersions('project', {
      keepDailyForDays: 0,
      keepLatestAutosaves: 0,
      now: '2026-03-01T00:00:00.000Z',
    })

    await expect(repository.readEmbedded({
      projectId: 'project',
      resourceId: 'logo',
      contentHash: first.write.contentHash,
    })).resolves.toBeUndefined()
    await expect(drafts.get('project:old')).resolves.toMatchObject({
      embeddedContents: [{
        resourceId: 'logo',
        contentHash: first.write.contentHash,
        bytes: new Uint8Array([1, 2, 3]),
      }],
    })
  })

  it('aborts pruning without writes when a reachable entity is missing', async () => {
    for (const kind of ['surface', 'dataset', 'resource'] as const) {
      const dbName = `project-document-v4-prune-missing-${kind}-${sequence++}`
      const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
      const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
      closeables.push(repository, storage)
      await repository.open()
      const embedded = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]))
      await repository.create({ document: embedded.document, embeddedContents: [embedded.write] })
      const snapshot = await readCurrentStoredProjectSnapshot(storage, 'project')
      if (!snapshot)
        throw new Error('Expected stored project snapshot fixture.')
      const missingKey = kind === 'surface'
        ? snapshot.surfaces.home!.key
        : kind === 'dataset'
          ? snapshot.datasets.countries!.key
          : snapshot.resources.logo!.key
      await storage.removeItem(missingKey)
      const keysBefore = (await storage.keys()).sort()
      const valuesBefore = await storage.getItems<unknown>(keysBefore)

      await expect(repository.pruneVersions('project', {
        keepDailyForDays: 0,
        keepLatestAutosaves: 0,
        now: '2026-03-01T00:00:00.000Z',
      })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
      const keysAfter = (await storage.keys()).sort()
      expect(keysAfter).toEqual(keysBefore)
      await expect(storage.getItems<unknown>(keysAfter)).resolves.toEqual(valuesBefore)
    }
  })

  it('rejects v3 and storage-key identity mismatches without rewriting them', async () => {
    const dbName = `project-document-v4-hard-cut-${sequence++}`
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const foreignSnapshot = {
      checksum: 'pending',
      datasets: {},
      project: {
        version: PROJECT_DOCUMENT_VERSION,
        id: 'foreign',
        name: 'Foreign',
        repositoryRevision: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        homeSurfaceId: 'home',
        surfaceOrder: [],
        datasetOrder: [],
        theme: { version: PROJECT_THEME_VERSION },
        registryLock: { adapter: 'element-plus', version: '1', fingerprint: 'x', components: {} },
        settings: {},
      },
      resources: {},
      surfaces: {},
    }
    foreignSnapshot.checksum = semanticChecksum({
      datasets: foreignSnapshot.datasets,
      project: foreignSnapshot.project,
      resources: foreignSnapshot.resources,
      surfaces: foreignSnapshot.surfaces,
    })
    const payload = { receipts: [], snapshot: foreignSnapshot, version: 4, versions: [] }
    const manifest = { ...payload, checksum: semanticChecksum(payload) }
    await storage.setItem(projectManifestKey('project'), manifest)

    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    await expect(repository.get('project')).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
    await storage.setItem(projectManifestKey('project'), { ...manifest, version: 3 })
    await expect(repository.get('project')).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('deletes formal records and every Recovery draft for the project', async () => {
    const dbName = `project-document-v4-delete-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const drafts = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(repository, drafts)
    await Promise.all([repository.open(), drafts.open()])
    const document = projectDocument()
    await repository.create({ document, embeddedContents: [] })
    await drafts.put({
      version: 2,
      baseRepositoryRevision: 0,
      changeSet: emptyChangeSet(),
      contentHash: 'content-0',
      document,
      draftId: 'project:session-a',
      editVersion: 1,
      embeddedContents: [],
      projectId: document.id,
      registryLock: document.registryLock,
      sessionId: 'session-a',
    })

    await repository.delete(document.id)
    await expect(repository.get(document.id)).resolves.toBeUndefined()
    await expect(drafts.get('project:session-a')).resolves.toBeUndefined()
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    expect((await storage.keys()).filter(key => key.includes('project'))).toEqual([])
  })

  it('deletes all hashes and drafts for one project without touching another project', async () => {
    const dbName = `project-document-v4-delete-isolation-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const drafts = createIndexedDBProjectRecoveryDraftStore({ dbName })
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(repository, drafts, storage)
    await Promise.all([repository.open(), drafts.open()])

    const projectA = await withEmbeddedResource(projectDocument(), new Uint8Array([1, 2, 3]), 'logo-a')
    const documentB = { ...projectDocument(), id: 'project-b', name: 'Project B', homeSurfaceId: 'home-b' }
    documentB.surfaceOrder = ['home-b']
    documentB.surfacesById = {
      'home-b': { ...documentB.surfacesById.home!, id: 'home-b' },
    }
    const projectB = await withEmbeddedResource(documentB, new Uint8Array([4, 5, 6]), 'logo-b')
    await repository.create({ document: projectA.document, embeddedContents: [projectA.write] })
    await repository.create({ document: projectB.document, embeddedContents: [projectB.write] })
    const projectASecond = await withEmbeddedResource(projectA.document, new Uint8Array([7, 8, 9]), 'logo-a')
    await repository.commit({
      commandId: 'project-a-second-hash',
      document: projectASecond.document,
      embeddedWrites: [projectASecond.write],
      expectedRepositoryRevision: 0,
      id: 'project',
      metadata: { source: 'manual' },
    })
    await drafts.put({
      version: 2,
      baseRepositoryRevision: 1,
      changeSet: emptyChangeSet(),
      contentHash: 'draft-a-1',
      document: projectASecond.document,
      draftId: 'project:session-a',
      editVersion: 1,
      embeddedContents: [projectASecond.write],
      projectId: 'project',
      registryLock: projectASecond.document.registryLock,
      sessionId: 'session-a',
    })
    await drafts.put({
      version: 2,
      baseRepositoryRevision: 0,
      changeSet: emptyChangeSet(),
      contentHash: 'draft-b-1',
      document: projectB.document,
      draftId: 'project-b:session-b',
      editVersion: 1,
      embeddedContents: [projectB.write],
      projectId: 'project-b',
      registryLock: projectB.document.registryLock,
      sessionId: 'session-b',
    })

    await repository.delete('project')
    await expect(repository.get('project')).resolves.toBeUndefined()
    await expect(drafts.list('project')).resolves.toEqual([])
    await expect(repository.readEmbedded({
      projectId: 'project-b',
      resourceId: 'logo-b',
      contentHash: projectB.write.contentHash,
    })).resolves.toEqual(new Uint8Array([4, 5, 6]))
    await expect(drafts.get('project-b:session-b')).resolves.toMatchObject({
      projectId: 'project-b',
      embeddedContents: [{ resourceId: 'logo-b' }],
    })
    expect((await storage.keys()).some(key => key.startsWith('project-document:project:'))).toBe(false)
    expect((await storage.keys()).some(key => key.startsWith('project-recovery-draft:project:'))).toBe(false)
    expect((await storage.keys()).some(key => key.startsWith('project-document:project-b:'))).toBe(true)
    expect((await storage.keys()).some(key => key.startsWith('project-recovery-draft:project-b:'))).toBe(true)
  })
})
