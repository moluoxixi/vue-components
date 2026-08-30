import type {
  ProjectDocument,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  applyProjectTransaction,
  createMemoryProjectRepository,
  createProjectDomainEngine,
  createProjectSnapshot,
  PROJECT_DOCUMENT_VERSION,
} from '../index'

const INITIAL_TIME = '2026-08-30T00:00:00.000Z'
const NEXT_TIME = '2026-08-30T00:01:00.000Z'

function projectDocument(): ProjectDocument {
  return {
    schemaVersion: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: {
      home: {
        id: 'home',
        name: 'Home',
        route: '/',
        graph: {
          version: 2,
          props: {},
          form: {},
          root: [{ nodeId: 'name', placement: {} }],
          nodesById: {
            name: {
              id: 'name',
              component: 'element.input',
              kind: 'field',
              field: 'name',
              label: 'Name',
              props: {},
              events: {},
              bindings: {},
            },
          },
        },
      },
    },
    registryLock: {
      adapter: 'element-plus',
      version: '2.9.1',
      fingerprint: 'fnv1a:registry',
      components: {
        'element.input': { contractVersion: '1', fingerprint: 'fnv1a:input' },
      },
    },
    settings: {},
    resources: {},
  }
}

function rename(document: ProjectDocument, name: string): ProjectDocument {
  const result = applyProjectTransaction(document, {
    id: `rename-${name}`,
    label: 'Rename page',
    operations: [{ type: 'page.rename', pageId: 'home', name }],
  })
  expect(result.success).toBe(true)
  if (!result.success)
    throw new Error(result.diagnostics[0]?.message)
  return result.document
}

describe('projectRepository', () => {
  it('stores validated entity snapshots and isolates returned documents', async () => {
    const repository = createMemoryProjectRepository({ now: () => NEXT_TIME })
    const initial = projectDocument()
    await repository.create({
      document: initial,
      seed: { repositoryRevision: 0, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME },
    })

    const loaded = await repository.get(initial.id)
    expect(loaded?.document).toEqual(initial)
    expect(loaded?.document).not.toBe(initial)
    loaded!.document.pagesById.home!.name = 'Mutated outside repository'
    expect((await repository.get(initial.id))?.document.pagesById.home?.name).toBe('Home')
    expect(await repository.list()).toEqual([expect.objectContaining({
      id: initial.id,
      pageCount: 1,
      repositoryRevision: 0,
    })])
  })

  it('commits with CAS and replays an identical command idempotently', async () => {
    const repository = createMemoryProjectRepository({ now: () => NEXT_TIME })
    const initial = projectDocument()
    await repository.create({
      document: initial,
      seed: { repositoryRevision: 0, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME },
    })
    const landing = rename(initial, 'Landing')
    const input = {
      commandId: 'save-landing',
      document: landing,
      expectedRepositoryRevision: 0,
      id: initial.id,
    }

    const committed = await repository.commit(input)
    const replayed = await repository.commit(input)
    expect(committed.replayed).toBe(false)
    expect(replayed.replayed).toBe(true)
    expect(replayed.project).toEqual(committed.project)
    expect(committed.project).toMatchObject({
      repositoryRevision: 1,
      createdAt: INITIAL_TIME,
      updatedAt: NEXT_TIME,
    })
    expect((await repository.get(initial.id))?.repositoryRevision).toBe(1)

    await expect(repository.commit({
      ...input,
      document: rename(landing, 'Different payload'),
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_COMMAND_REUSED' })
  })

  it('rejects stale revisions without replacing the committed project', async () => {
    const repository = createMemoryProjectRepository({ now: () => NEXT_TIME })
    const initial = projectDocument()
    await repository.create({
      document: initial,
      seed: { repositoryRevision: 0, createdAt: INITIAL_TIME, updatedAt: INITIAL_TIME },
    })
    await repository.commit({
      commandId: 'save-remote',
      document: rename(initial, 'Remote'),
      expectedRepositoryRevision: 0,
      id: initial.id,
    })

    await expect(repository.commit({
      commandId: 'save-stale',
      document: rename(initial, 'Stale'),
      expectedRepositoryRevision: 0,
      id: initial.id,
    })).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' })
    expect((await repository.get(initial.id))?.document.pagesById.home?.name).toBe('Remote')
  })
})

describe('projectDomainEngine', () => {
  it('resolves commands before committing one transaction', () => {
    const initial = projectDocument()
    const initialSnapshot = createProjectSnapshot(initial, 5)
    const engine = createProjectDomainEngine({ document: initialSnapshot })
    const command = {
      id: 'rename-through-command',
      label: 'Rename through command',
      actions: [{
        type: 'operation.apply' as const,
        operations: [{ type: 'page.rename' as const, pageId: 'home', name: 'Command page' }],
      }],
    }

    expect(engine.snapshot).toMatchObject({
      document: initial,
      editVersion: 5,
      contentHash: initialSnapshot.contentHash,
    })
    expect(engine.execute(command).changed).toBe(true)
    expect(engine.snapshot.document.pagesById.home?.name).toBe('Command page')
    expect(engine.snapshot.editVersion).toBe(6)
    expect(engine.snapshot.contentHash).not.toBe(initialSnapshot.contentHash)
    expect(engine.execute(command).changed).toBe(false)
    expect(engine.snapshot.editVersion).toBe(6)
    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.pagesById.home?.name).toBe('Home')
    expect(engine.snapshot.editVersion).toBe(7)
    expect(engine.snapshot.contentHash).toBe(initialSnapshot.contentHash)
  })

  it('owns one project history and makes command ids idempotent', () => {
    const initial = projectDocument()
    const engine = createProjectDomainEngine({ document: initial })
    const command = {
      id: 'rename-home',
      label: 'Rename home',
      actions: [{
        type: 'operation.apply' as const,
        operations: [{ type: 'page.rename' as const, pageId: 'home', name: 'Landing' }],
      }],
    }

    const changed = engine.execute(command)
    expect(changed.changed).toBe(true)
    expect(changed.changeSet).toEqual({ project: false, pageIds: ['home'], nodeIds: [] })
    expect(engine.snapshot.document.pagesById.home?.name).toBe('Landing')
    const changedCursor = engine.snapshot.cursor

    expect(engine.execute(command).changed).toBe(false)
    expect(engine.snapshot.editVersion).toBe(1)
    expect(engine.execute({
      ...command,
      actions: [{
        type: 'operation.apply',
        operations: [{ type: 'page.rename', pageId: 'home', name: 'Different' }],
      }],
    }).diagnostics[0]?.code).toBe('PROJECT_COMMAND_ID_REUSED')

    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.pagesById.home?.name).toBe('Home')
    expect(engine.snapshot.cursor).not.toBe(changedCursor)
    expect(engine.redo().changed).toBe(true)
    expect(engine.snapshot.document.pagesById.home?.name).toBe('Landing')
    expect(engine.snapshot.cursor).toBe(changedCursor)
  })
})
