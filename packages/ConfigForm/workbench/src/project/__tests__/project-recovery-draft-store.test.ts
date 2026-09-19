import type {
  ProjectChangeSet,
  ProjectDocument,
  ProjectEmbeddedResourceWrite,
} from '@moluoxixi/config-form-model'
import type {
  StoredRecoveryDraftBytes,
  StoredRecoveryDraftManifest,
} from '../persistence'
import {
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createIndexedDBProjectRecoveryDraftStore,
  createMemoryProjectRecoveryDraftStore,
} from '../persistence'
import 'fake-indexeddb/auto'

const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(closeable => closeable.close())
})

function projectDocument(): ProjectDocument {
  const registryComponents = {
    'element.input': {
      contractVersion: '1',
      fingerprint: 'fnv1a:00000001',
    },
  }
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
          root: [{ nodeId: 'name-field', placement: {} }],
          nodesById: {
            'name-field': {
              id: 'name-field',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              props: {},
            },
          },
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
      fingerprint: registryLockFingerprint(registryComponents),
      components: registryComponents,
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

async function withEmbeddedResources(
  document: ProjectDocument,
  entries: readonly { id: string, bytes: Uint8Array }[],
): Promise<{ document: ProjectDocument, writes: ProjectEmbeddedResourceWrite[] }> {
  const next = structuredClone(document)
  const writes: ProjectEmbeddedResourceWrite[] = []
  for (const { id, bytes } of entries) {
    const hash = await contentHash(bytes)
    next.resources[id] = {
      id,
      name: id,
      kind: 'embedded',
      fileName: `${id}.bin`,
      mediaType: 'application/octet-stream',
      byteLength: bytes.byteLength,
      contentHash: hash,
    }
    writes.push({
      resourceId: id,
      contentHash: hash,
      bytes: new Uint8Array(bytes),
    })
  }
  return { document: next, writes }
}

function changeSet(resourceIds: readonly string[]): ProjectChangeSet {
  return {
    project: false,
    surfaceIds: ['home'],
    datasetIds: ['countries'],
    resourceIds: [...resourceIds],
    nodeChanges: [{
      surfaceId: 'home',
      nodeId: 'name-field',
      kind: 'content',
    }],
  }
}

function capture(
  document: ProjectDocument,
  embeddedContents: readonly ProjectEmbeddedResourceWrite[],
  editVersion: number,
  baseRepositoryRevision = 0,
) {
  return {
    version: 2 as const,
    baseRepositoryRevision,
    changeSet: changeSet(embeddedContents.map(write => write.resourceId)),
    contentHash: `content-${editVersion}`,
    document,
    draftId: 'project:session-a',
    editVersion,
    embeddedContents,
    projectId: document.id,
    registryLock: document.registryLock,
    sessionId: 'session-a',
  }
}

function createStorage(dbName: string): IndexDBStorage {
  const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
  closeables.push(storage)
  return storage
}

async function draftKeys(storage: IndexDBStorage): Promise<string[]> {
  return (await storage.keys()).filter(key => key.startsWith('project-recovery-draft:'))
}

async function manifestKey(storage: IndexDBStorage): Promise<string> {
  const keys = (await draftKeys(storage)).filter(key => key.endsWith(':manifest'))
  expect(keys).toHaveLength(1)
  return keys[0]!
}

async function byteKey(storage: IndexDBStorage): Promise<string> {
  const keys = (await draftKeys(storage)).filter(key => key.includes(':resource-bytes:'))
  expect(keys).toHaveLength(1)
  return keys[0]!
}

describe('projectRecoveryDraftStore v2', () => {
  it('keeps volatile drafts copy-isolated and rejects an older overwrite', async () => {
    const store = createMemoryProjectRecoveryDraftStore({
      now: () => '2026-08-31T12:00:00.000Z',
    })
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    const newer = capture(
      renameSurface(embedded.document, 'Newer draft'),
      embedded.writes.map(write => ({ ...write, bytes: new Uint8Array(write.bytes) })),
      2,
    )
    await store.put(newer)
    newer.embeddedContents[0]!.bytes[0] = 9
    await store.put(capture(embedded.document, embedded.writes, 1))

    expect(store.persistence).toBe('volatile')
    const first = await store.get('project:session-a')
    expect(first).toMatchObject({
      version: 2,
      document: { surfacesById: { home: { name: 'Newer draft' } } },
      editVersion: 2,
      embeddedContents: [{ resourceId: 'logo' }],
    })
    expect(first!.embeddedContents[0]!.bytes).toEqual(new Uint8Array([1, 2, 3]))
    first!.embeddedContents[0]!.bytes[1] = 8
    expect((await store.get('project:session-a'))!.embeddedContents[0]!.bytes)
      .toEqual(new Uint8Array([1, 2, 3]))
    expect(await store.list(embedded.document.id)).toEqual([
      expect.objectContaining({
        changedDatasetIds: ['countries'],
        changedNodeCount: 1,
        changedResourceIds: ['logo'],
        changedSurfaceIds: ['home'],
        editVersion: 2,
      }),
    ])
  })

  it('captures the complete durable input before byte validation yields', async () => {
    const dbName = `recovery-draft-v2-captured-input-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'alpha', bytes: new Uint8Array([1, 2, 3]) },
      { id: 'zeta', bytes: new Uint8Array([4, 5, 6]) },
    ])
    const input = capture(embedded.document, embedded.writes, 1)

    const pending = store.put(input)
    input.contentHash = 'mutated-after-call'
    input.editVersion = 2
    input.embeddedContents[1]!.bytes[0] = 9
    const saved = await pending

    expect(saved).toMatchObject({ contentHash: 'content-1', editVersion: 1 })
    const restored = await store.get(input.draftId)
    expect(restored).toMatchObject({ contentHash: 'content-1', editVersion: 1 })
    expect(restored!.embeddedContents.map(write => [...write.bytes]))
      .toEqual([[1, 2, 3], [4, 5, 6]])
  })

  it('reopens a complete durable byte snapshot in deterministic order with fresh copies', async () => {
    const dbName = `recovery-draft-v2-reopen-${sequence++}`
    const first = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(first)
    await first.open()
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'zeta', bytes: new Uint8Array([9, 8]) },
      { id: 'alpha', bytes: new Uint8Array([1, 2, 3]) },
    ])
    await first.put(capture(renameSurface(embedded.document, 'Recovered Surface'), embedded.writes, 1))
    embedded.writes[0]!.bytes[0] = 0
    embedded.writes[1]!.bytes[0] = 0
    first.close()

    const reopened = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(reopened)
    await reopened.open()
    const restored = await reopened.get('project:session-a')
    expect(restored).toMatchObject({
      version: 2,
      baseRepositoryRevision: 0,
      contentHash: 'content-1',
      document: { surfacesById: { home: { name: 'Recovered Surface' } } },
      editVersion: 1,
    })
    expect(restored!.embeddedContents.map(write => write.resourceId)).toEqual(['alpha', 'zeta'])
    expect(restored!.embeddedContents.map(write => [...write.bytes])).toEqual([[1, 2, 3], [9, 8]])
    restored!.embeddedContents[0]!.bytes[0] = 7
    expect((await reopened.get('project:session-a'))!.embeddedContents[0]!.bytes)
      .toEqual(new Uint8Array([1, 2, 3]))

    const keys = await draftKeys(createStorage(dbName))
    expect(keys.filter(key => key.includes(':resource-bytes:'))).toHaveLength(2)
    expect(keys.some(key => key.includes(':page:'))).toBe(false)
  })

  it('rejects non-v2 captures and incomplete, duplicate, or extra byte snapshots', async () => {
    const store = createMemoryProjectRecoveryDraftStore()
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    const valid = capture(embedded.document, embedded.writes, 1)

    await expect(store.put({ ...valid, version: 1 } as never)).rejects.toThrow('identity')
    await expect(store.put({ ...valid, version: 3 } as never)).rejects.toThrow('identity')
    await expect(store.put({ ...valid, embeddedContents: [] })).rejects.toThrow('missing')
    await expect(store.put({
      ...valid,
      embeddedContents: [embedded.writes[0]!, embedded.writes[0]!],
    })).rejects.toThrow('duplicated')
    await expect(store.put({
      ...valid,
      embeddedContents: [{
        resourceId: 'undeclared',
        contentHash: embedded.writes[0]!.contentHash,
        bytes: new Uint8Array([1, 2, 3]),
      }],
    })).rejects.toThrow('not declared')
    await expect(store.get(valid.draftId)).resolves.toBeUndefined()
  })

  it.each([1, 3])('fails closed for stored Recovery Draft version %i', async (version) => {
    const dbName = `recovery-draft-version-${version}-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    await store.put(capture(projectDocument(), [], 1))
    const storage = createStorage(dbName)
    const key = await manifestKey(storage)
    const manifest = await storage.getItem<StoredRecoveryDraftManifest>(key)
    await storage.setItem(key, { ...manifest!, version })

    await expect(store.get('project:session-a'))
      .rejects
      .toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('rejects a mixed v2 manifest with a v1 byte record', async () => {
    const dbName = `recovery-draft-mixed-version-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    await store.put(capture(embedded.document, embedded.writes, 1))
    const storage = createStorage(dbName)
    const key = await byteKey(storage)
    const record = await storage.getItem<StoredRecoveryDraftBytes>(key)
    await storage.setItem(key, { ...record!, version: 1 })

    await expect(store.get('project:session-a'))
      .rejects
      .toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it.each(['missing', 'damaged'] as const)('rejects %s draft bytes', async (failure) => {
    const dbName = `recovery-draft-corrupt-${failure}-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const embedded = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    await store.put(capture(embedded.document, embedded.writes, 1))
    const storage = createStorage(dbName)
    const key = await byteKey(storage)
    if (failure === 'missing') {
      await storage.removeItem(key)
    }
    else {
      const record = await storage.getItem<StoredRecoveryDraftBytes>(key)
      await storage.setItem(key, { ...record!, bytes: new Uint8Array([1, 2, 4]) })
    }

    await expect(store.get('project:session-a'))
      .rejects
      .toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('atomically replaces obsolete bytes and deletes the complete draft namespace', async () => {
    const dbName = `recovery-draft-replace-delete-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const first = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    await store.put(capture(first.document, first.writes, 1))
    const storage = createStorage(dbName)
    const oldByteKey = await byteKey(storage)

    const second = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([4, 5, 6]) },
    ])
    await store.put(capture(renameSurface(second.document, 'Second draft'), second.writes, 2))
    const keysAfterReplace = await draftKeys(storage)
    expect(keysAfterReplace).not.toContain(oldByteKey)
    expect(keysAfterReplace.filter(key => key.includes(':resource-bytes:'))).toHaveLength(1)
    expect((await store.get('project:session-a'))!.embeddedContents[0]!.bytes)
      .toEqual(new Uint8Array([4, 5, 6]))

    await store.delete('project:session-a')
    await expect(store.get('project:session-a')).resolves.toBeUndefined()
    await expect(draftKeys(storage)).resolves.toEqual([])
  })

  it('retains the complete previous draft when replacement aborts', async () => {
    const dbName = `recovery-draft-abort-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const first = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([1, 2, 3]) },
    ])
    await store.put(capture(renameSurface(first.document, 'First draft'), first.writes, 1))
    const storage = createStorage(dbName)
    const oldKeys = await draftKeys(storage)

    const second = await withEmbeddedResources(projectDocument(), [
      { id: 'logo', bytes: new Uint8Array([4, 5, 6]) },
    ])
    const originalPut = IDBObjectStore.prototype.put
    let putCount = 0
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      putCount += 1
      if (putCount === 2)
        throw new DOMException('Injected draft quota failure.', 'QuotaExceededError')
      return key === undefined
        ? originalPut.call(this, value)
        : originalPut.call(this, value, key)
    })

    try {
      await expect(store.put(capture(renameSurface(second.document, 'Second draft'), second.writes, 2)))
        .rejects
        .toThrow()
    }
    finally {
      putSpy.mockRestore()
    }

    const restored = await store.get('project:session-a')
    expect(restored).toMatchObject({
      contentHash: 'content-1',
      document: { surfacesById: { home: { name: 'First draft' } } },
      editVersion: 1,
    })
    expect(restored!.embeddedContents[0]!.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(await draftKeys(storage)).toEqual(oldKeys)
  })
})
