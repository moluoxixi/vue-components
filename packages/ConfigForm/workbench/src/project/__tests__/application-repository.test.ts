import type { WorkspaceApplicationRepository } from '../application-repository'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateWorkspaceProjectToApplication } from '../application'
import { createMemoryWorkspaceApplicationRepository } from '../application-repository'
import {
  createIndexedDBWorkspaceApplicationRepository,
} from '../application-repository-indexed-db'
import { createIndexedDBWorkspaceProjectRepository } from '../repository-indexed-db'
import { createDraftFixture, createProjectFixture, NEXT_TIME } from './fixtures'
import 'fake-indexeddb/auto'

const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(item => item.close())
})

function repositoryContract(
  name: string,
  create: () => WorkspaceApplicationRepository,
): void {
  describe(name, () => {
    it('creates, isolates, lists, commits, drafts, and deletes applications', async () => {
      const repository = create()
      closeables.push(repository)
      const application = migrateWorkspaceProjectToApplication(createProjectFixture())
      await repository.create(application)
      application.name = 'External mutation'

      await expect(repository.get(application.id)).resolves.toMatchObject({ name: 'Fixture project' })
      await expect(repository.list()).resolves.toEqual([
        expect.objectContaining({ id: application.id, pageCount: 1, revision: 1 }),
      ])

      const stored = (await repository.get(application.id))!
      const committed = await repository.commit(stored.id, 1, { ...stored, name: 'Committed' })
      expect(committed).toMatchObject({ name: 'Committed', revision: 2, updatedAt: NEXT_TIME })
      await expect(repository.commit(stored.id, 1, stored)).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })

      const draft = {
        activePageId: committed.homePageId,
        application: committed,
        baseRevision: committed.revision,
        updatedAt: NEXT_TIME,
      }
      await repository.saveDraft(committed.id, draft)
      await expect(repository.getDraft(committed.id)).resolves.toEqual(draft)
      await repository.delete(committed.id)
      await expect(repository.get(committed.id)).resolves.toBeUndefined()
    })
  })
}

repositoryContract('memory application repository', () => createMemoryWorkspaceApplicationRepository({ now: () => NEXT_TIME }))
repositoryContract('IndexedDB application repository', () => createIndexedDBWorkspaceApplicationRepository({
  dbName: `workbench-application-${sequence++}`,
  now: () => NEXT_TIME,
}))

describe('legacy IndexedDB migration', () => {
  it('moves each v1 project and draft to an independent v2 application', async () => {
    const dbName = `workbench-legacy-application-${sequence++}`
    const legacyRepository = createIndexedDBWorkspaceProjectRepository({ dbName })
    closeables.push(legacyRepository)
    const legacy = createProjectFixture()
    await legacyRepository.create(legacy)
    await legacyRepository.saveDraft(legacy.id, createDraftFixture())

    const repository = createIndexedDBWorkspaceApplicationRepository({ dbName, now: () => NEXT_TIME })
    closeables.push(repository)
    await repository.open()

    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: legacy.id, pageCount: 1 }),
    ])
    await expect(repository.get(legacy.id)).resolves.toMatchObject({
      homePageId: 'home',
      schemaVersion: 2,
    })
    await expect(repository.getDraft(legacy.id)).resolves.toMatchObject({
      activePageId: 'home',
      baseRevision: 1,
    })
    expect(repository.migrationErrors).toEqual([])
    await expect(legacyRepository.get(legacy.id)).resolves.toBeUndefined()
  })
})
