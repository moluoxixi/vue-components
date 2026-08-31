import type { ProjectChangeSet, ProjectDocument } from '@moluoxixi/config-form-model'
import { applyProjectTransaction } from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIndexedDBProjectRepository } from '../project-document-repository-indexed-db'
import {
  createIndexedDBProjectRecoveryDraftStore,
  createMemoryProjectRecoveryDraftStore,
} from '../project-recovery-draft-store'
import { createProjectDocumentFixture } from './fixtures'
import 'fake-indexeddb/auto'

const EMPTY_CHANGE_SET: ProjectChangeSet = {
  project: false,
  pageIds: [],
  nodeIds: [],
  nodeChanges: [],
}
const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(closeable => closeable.close())
})

function rename(document: ProjectDocument, name: string): ProjectDocument {
  const result = applyProjectTransaction(document, {
    id: `rename-${name}`,
    label: 'Rename page',
    operations: [{ type: 'page.rename', pageId: document.homePageId, name }],
  })
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message)
  return result.document
}

function capture(document: ProjectDocument, editVersion: number) {
  return {
    baseRepositoryRevision: 0,
    changeSet: {
      ...EMPTY_CHANGE_SET,
      pageIds: [document.homePageId],
    },
    contentHash: `content-${editVersion}`,
    document,
    draftId: 'project:session-a',
    editVersion,
    projectId: document.id,
    registryLock: document.registryLock,
    sessionId: 'session-a',
  }
}

describe('projectRecoveryDraftStore', () => {
  it('keeps volatile drafts isolated and rejects an older overwrite', async () => {
    const store = createMemoryProjectRecoveryDraftStore({
      now: () => '2026-08-31T12:00:00.000Z',
    })
    const initial = createProjectDocumentFixture()
    const newer = rename(initial, 'Newer draft')
    await store.put(capture(newer, 2))
    await store.put(capture(initial, 1))

    expect(store.persistence).toBe('volatile')
    expect((await store.get('project:session-a'))?.document.pagesById.home?.name).toBe('Newer draft')
    expect(await store.list(initial.id)).toEqual([
      expect.objectContaining({ editVersion: 2, projectId: initial.id }),
    ])
  })

  it('reopens a durable draft through the shared snapshot codec', async () => {
    const dbName = `recovery-draft-reopen-${sequence++}`
    const first = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(first)
    await first.open()
    const initial = createProjectDocumentFixture()
    const draft = rename(initial, 'Recovered page')
    await first.put(capture(draft, 1))
    first.close()

    const reopened = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(reopened)
    await reopened.open()
    expect(reopened.persistence).toBe('durable')
    await expect(reopened.get('project:session-a')).resolves.toMatchObject({
      baseRepositoryRevision: 0,
      contentHash: 'content-1',
      document: { pagesById: { home: { name: 'Recovered page' } } },
      editVersion: 1,
    })
  })

  it('reuses unchanged entities from the formal base snapshot', async () => {
    const dbName = `recovery-draft-reuse-${sequence++}`
    const repository = createIndexedDBProjectRepository({ dbName })
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(repository, store)
    await Promise.all([repository.open(), store.open()])
    const initial = createProjectDocumentFixture()
    await repository.create({ document: initial })

    await store.put(capture(initial, 1))
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const draftKeys = (await storage.keys()).filter(key => key.startsWith('project-recovery-draft:'))
    expect(draftKeys).toHaveLength(1)
    expect(draftKeys[0]).toMatch(/:manifest$/)
    await expect(store.get('project:session-a')).resolves.toMatchObject({
      document: { id: initial.id },
      editVersion: 1,
    })
  })

  it('retains the previous durable draft when a rebased write aborts', async () => {
    const dbName = `recovery-draft-abort-${sequence++}`
    const store = createIndexedDBProjectRecoveryDraftStore({ dbName })
    closeables.push(store)
    await store.open()
    const initial = createProjectDocumentFixture()
    await store.put(capture(rename(initial, 'First draft'), 1))

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
      await expect(store.put(capture(rename(initial, 'Second draft'), 2))).rejects.toThrow()
    }
    finally {
      putSpy.mockRestore()
    }

    await expect(store.get('project:session-a')).resolves.toMatchObject({
      contentHash: 'content-1',
      document: { pagesById: { home: { name: 'First draft' } } },
      editVersion: 1,
    })
  })
})
