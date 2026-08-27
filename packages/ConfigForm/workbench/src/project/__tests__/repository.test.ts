import type { WorkspaceProjectRepository } from '../repository'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createIndexedDBWorkspaceProjectRepository, openDefaultWorkspaceProjectRepository } from '../repository-indexed-db'
import { createMemoryWorkspaceProjectRepository } from '../repository-memory'
import { createDraftFixture, createProjectFixture, NEXT_TIME } from './fixtures'
import 'fake-indexeddb/auto'

type RepositoryFactory = () => WorkspaceProjectRepository

const repositories: WorkspaceProjectRepository[] = []
let databaseSequence = 0

function memoryRepository(): WorkspaceProjectRepository {
  const repository = createMemoryWorkspaceProjectRepository({ now: () => NEXT_TIME })
  repositories.push(repository)
  return repository
}

function indexedRepository(dbName?: string): WorkspaceProjectRepository {
  const repository = createIndexedDBWorkspaceProjectRepository({
    dbName: dbName ?? `workbench-repository-${databaseSequence++}`,
    now: () => NEXT_TIME,
  })
  repositories.push(repository)
  return repository
}

afterEach(() => {
  repositories.splice(0).forEach(repository => repository.close())
  vi.unstubAllGlobals()
})

function repositoryContract(name: string, factory: RepositoryFactory): void {
  describe(name, () => {
    it('creates, lists, isolates, and deletes projects', async () => {
      const repository = factory()
      const project = createProjectFixture()
      await repository.create(project)
      project.name = 'Mutated outside repository'

      await expect(repository.get('fixture-project')).resolves.toMatchObject({ name: 'Fixture project' })
      await expect(repository.list()).resolves.toEqual([expect.objectContaining({
        id: 'fixture-project',
        name: 'Fixture project',
        revision: 1,
      })])
      await expect(repository.create(createProjectFixture())).rejects.toMatchObject({ code: 'PROJECT_EXISTS' })

      await repository.delete('fixture-project')
      await expect(repository.get('fixture-project')).resolves.toBeUndefined()
    })

    it('commits with compare-and-swap and keeps drafts separate', async () => {
      const repository = factory()
      const project = createProjectFixture()
      await repository.create(project)
      await repository.saveDraft(project.id, createDraftFixture())

      const next = createProjectFixture({ name: 'Committed name' })
      const committed = await repository.commit(project.id, 1, next)

      expect(committed).toMatchObject({ name: 'Committed name', revision: 2, updatedAt: NEXT_TIME })
      await expect(repository.getDraft(project.id)).resolves.toEqual(createDraftFixture())
      await expect(repository.commit(project.id, 1, next)).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
      await expect(repository.get(project.id)).resolves.toMatchObject({ revision: 2 })

      await repository.saveDraft(project.id)
      await expect(repository.getDraft(project.id)).resolves.toBeUndefined()
    })
  })
}

repositoryContract('memory repository', memoryRepository)
repositoryContract('IndexedDB repository', indexedRepository)

describe('indexedDB repository concurrency', () => {
  it('allows only one connection to commit the same base revision', async () => {
    const dbName = `workbench-cas-${databaseSequence++}`
    const first = indexedRepository(dbName)
    const second = indexedRepository(dbName)
    const project = createProjectFixture()
    await first.create(project)

    const results = await Promise.allSettled([
      first.commit(project.id, 1, createProjectFixture({ name: 'First' })),
      second.commit(project.id, 1, createProjectFixture({ name: 'Second' })),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    await expect(first.get(project.id)).resolves.toMatchObject({ revision: 2 })
  })

  it('does not leak a draft when saving races with project deletion', async () => {
    const dbName = `workbench-draft-delete-${databaseSequence++}`
    const first = indexedRepository(dbName)
    const second = indexedRepository(dbName)
    const project = createProjectFixture()
    await first.create(project)

    await Promise.allSettled([
      first.saveDraft(project.id, createDraftFixture()),
      second.delete(project.id),
    ])
    await first.create(project)

    await expect(second.getDraft(project.id)).resolves.toBeUndefined()
  })
})

describe('default repository selection', () => {
  it('uses an explicit volatile repository when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const repository = await openDefaultWorkspaceProjectRepository({ now: () => NEXT_TIME })
    repositories.push(repository)

    expect(repository.persistence).toBe('volatile')
    await repository.create(createProjectFixture())
    await expect(repository.list()).resolves.toHaveLength(1)
  })

  it('falls back when the IndexedDB API exists but opening the database fails', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('Storage is blocked', 'SecurityError')
      },
    })
    const repository = await openDefaultWorkspaceProjectRepository({ now: () => NEXT_TIME })
    repositories.push(repository)

    expect(repository.persistence).toBe('volatile')
  })
})
