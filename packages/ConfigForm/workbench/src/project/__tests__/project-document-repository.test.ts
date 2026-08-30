import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { ProjectDocument, RegistryLock } from '@moluoxixi/config-form-model'
import { CONFIG_FORM_FLOW_VERSION, getConfigFormJsonSemanticHash } from '@moluoxixi/config-form-core'
import {
  applyProjectTransaction,
  migrateLegacyWorkspaceApplication,
} from '@moluoxixi/config-form-model'
import { IndexDBStorage } from '@moluoxixi/indexed-db'
import { afterEach, describe, expect, it } from 'vitest'
import { migrateWorkspaceProjectToApplication } from '../application'
import { createIndexedDBWorkspaceApplicationRepository } from '../application-repository-indexed-db'
import {
  createIndexedDBProjectRepository,
} from '../project-document-repository-indexed-db'
import { createProjectFixture } from './fixtures'
import 'fake-indexeddb/auto'

const registryLock: RegistryLock = {
  adapter: 'element-plus',
  version: '1',
  fingerprint: 'fnv1a:fixture-registry',
  components: {},
}
const closeables: Array<{ close: () => void }> = []
let sequence = 0

afterEach(() => {
  closeables.splice(0).forEach(closeable => closeable.close())
})

function repositoryOptions(dbName: string) {
  return {
    dbName,
    resolveRegistryLock: async () => registryLock,
  }
}

function projectDocument(): ProjectDocument {
  const application = migrateWorkspaceProjectToApplication(createProjectFixture())
  const migrated = migrateLegacyWorkspaceApplication(application, { registryLock })
  if (!migrated.success)
    throw new Error(migrated.diagnostics[0]?.message)
  return migrated.data
}

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

function mountedFlow(): ConfigFormFlow {
  return {
    version: CONFIG_FORM_FLOW_VERSION,
    id: 'mounted',
    name: 'Mounted',
    trigger: { kind: 'page.mount' },
    nodes: [
      { id: 'trigger', type: 'trigger' },
      { id: 'success', type: 'success' },
    ],
    edges: [{ id: 'mounted-edge', source: 'trigger', target: 'success' }],
  }
}

function semanticChecksum(value: unknown): string {
  return `fnv1a:${getConfigFormJsonSemanticHash(value)}`
}

describe('indexedDBProjectRepository', () => {
  it('stores manifest and versioned page entities as separate records', async () => {
    const dbName = `project-document-entities-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    const created = await repository.create({ document: initial })

    await expect(repository.get(initial.id)).resolves.toEqual(created)
    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({ id: initial.id, pageCount: 1, repositoryRevision: created.repositoryRevision }),
    ])

    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const keys = await storage.keys()
    expect(keys.filter(key => key.includes('project-document:'))).toEqual(expect.arrayContaining([
      expect.stringContaining(':manifest'),
      expect.stringContaining(':page:'),
    ]))
    expect(keys.filter(key => key.includes('project-document:'))).toHaveLength(2)
  })

  it('commits atomically with CAS and replays a commit receipt', async () => {
    const dbName = `project-document-commit-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    const created = await repository.create({ document: initial })
    const landing = rename(initial, 'Landing')
    const input = {
      commandId: 'save-landing',
      document: landing,
      expectedRepositoryRevision: created.repositoryRevision,
      id: initial.id,
    }

    const committed = await repository.commit(input)
    const replayed = await repository.commit(input)
    expect(committed).toMatchObject({
      replayed: false,
      project: {
        document: landing,
        repositoryRevision: created.repositoryRevision + 1,
      },
    })
    expect(replayed).toMatchObject({
      replayed: true,
      project: {
        document: landing,
        repositoryRevision: created.repositoryRevision + 1,
      },
    })
    expect(replayed.project).toEqual(committed.project)
    expect(committed.project.entityRevisions.pages.home).toBe(committed.project.repositoryRevision)
  })

  it('reuses unchanged entity revisions while advancing the repository manifest', async () => {
    const dbName = `project-document-entity-reuse-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    const created = await repository.create({ document: initial })

    const committed = await repository.commit({
      commandId: 'save-identical-document',
      document: initial,
      expectedRepositoryRevision: created.repositoryRevision,
      id: initial.id,
    })

    expect(committed.project.repositoryRevision).toBe(created.repositoryRevision + 1)
    expect(committed.project.entityRevisions.pages).toEqual(created.entityRevisions.pages)
  })

  it('persists page-owned flows in the same revisioned Page entity as the visual graph', async () => {
    const dbName = `project-document-page-flow-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    const created = await repository.create({ document: initial })
    const withFlow = applyProjectTransaction(initial, {
      id: 'add-page-flow',
      label: 'Add page flow',
      operations: [{
        type: 'flow.add',
        pageId: initial.homePageId,
        flow: mountedFlow(),
      }],
    })
    if (!withFlow.success)
      throw new Error(withFlow.diagnostics[0]?.message)

    const committed = await repository.commit({
      commandId: 'save-page-flow',
      document: withFlow.document,
      expectedRepositoryRevision: created.repositoryRevision,
      id: initial.id,
    })
    const reloaded = await repository.get(initial.id)

    expect(committed.project.entityRevisions.pages.home).toBe(committed.project.repositoryRevision)
    expect(reloaded?.document.pagesById.home?.flows?.map(flow => flow.id)).toEqual(['mounted'])
    expect(reloaded?.document.pagesById.home?.graph).not.toHaveProperty('flows')
  })

  it('migrates persisted v3 graph-owned flows when loading the current repository', async () => {
    const dbName = `project-document-v3-flow-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    await repository.create({ document: initial })

    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const keys = await storage.keys()
    const pageKey = keys.find(key => key.includes(':page:'))!
    const manifestKey = keys.find(key => key.endsWith(':manifest'))!
    const entity = await storage.getItem<Record<string, unknown>>(pageKey) as {
      checksum: string
      value: ProjectDocument['pagesById'][string] & { graph: { flows?: ConfigFormFlow[] } }
    }
    const manifest = await storage.getItem<Record<string, unknown>>(manifestKey) as {
      checksum: string
      receipts: unknown[]
      snapshot: {
        checksum: string
        pages: Record<string, { checksum: string }>
        project: Record<string, unknown>
        resources: Record<string, unknown>
      }
      storageSchemaVersion: number
    }

    entity.value.graph.flows = [mountedFlow()]
    delete entity.value.flows
    entity.checksum = semanticChecksum(entity.value)
    manifest.snapshot.project.schemaVersion = 3
    manifest.snapshot.pages.home!.checksum = entity.checksum
    manifest.snapshot.checksum = semanticChecksum({
      pages: manifest.snapshot.pages,
      project: manifest.snapshot.project,
      resources: manifest.snapshot.resources,
    })
    manifest.checksum = semanticChecksum({
      receipts: manifest.receipts,
      snapshot: manifest.snapshot,
      storageSchemaVersion: manifest.storageSchemaVersion,
    })
    await storage.setItem(pageKey, entity)
    await storage.setItem(manifestKey, manifest)

    const migrated = await repository.get(initial.id)
    expect(migrated?.document.schemaVersion).toBe(4)
    expect(migrated?.document.pagesById.home?.flows).toEqual([mountedFlow()])
    expect(migrated?.document.pagesById.home?.graph).not.toHaveProperty('flows')
  })

  it('serializes concurrent multi-record commits across connections', async () => {
    const dbName = `project-document-cas-${sequence++}`
    const first = createIndexedDBProjectRepository(repositoryOptions(dbName))
    const second = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(first, second)
    await Promise.all([first.open(), second.open()])
    const initial = projectDocument()
    const created = await first.create({ document: initial })

    const results = await Promise.allSettled([
      first.commit({
        commandId: 'save-first',
        document: rename(initial, 'First'),
        expectedRepositoryRevision: created.repositoryRevision,
        id: initial.id,
      }),
      second.commit({
        commandId: 'save-second',
        document: rename(initial, 'Second'),
        expectedRepositoryRevision: created.repositoryRevision,
        id: initial.id,
      }),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(result => result.status === 'rejected')
    expect(rejected).toMatchObject({ reason: { code: 'PROJECT_REVISION_CONFLICT' } })
    expect(['First', 'Second']).toContain((await first.get(initial.id))?.document.pagesById.home?.name)
  })

  it('rejects a manifest whose referenced entity is missing', async () => {
    const dbName = `project-document-corrupt-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    await repository.create({ document: initial })

    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const pageKey = (await storage.keys()).find(key => key.includes(':page:'))!
    await storage.removeItem(pageKey)
    await expect(repository.get(initial.id)).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('rejects an entity whose revision disagrees with its manifest reference', async () => {
    const dbName = `project-document-revision-corrupt-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    await repository.create({ document: initial })

    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    const pageKey = (await storage.keys()).find(key => key.includes(':page:'))!
    const entity = await storage.getItem<Record<string, unknown>>(pageKey)
    await storage.setItem(pageKey, { ...entity, revision: Number(entity?.revision) + 1 })

    await expect(repository.get(initial.id)).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_CORRUPT' })
  })

  it('rejects invalid persistence metadata before writing any records', async () => {
    const dbName = `project-document-invalid-seed-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()

    await expect(repository.create({
      document: initial,
      seed: {
        repositoryRevision: -1,
        createdAt: 'invalid',
        updatedAt: 'invalid',
      },
    })).rejects.toMatchObject({ code: 'PROJECT_REPOSITORY_INVALID_COMMIT' })
    await expect(repository.get(initial.id)).resolves.toBeUndefined()
  })

  it('migrates legacy applications only after a complete ProjectDocument is stored', async () => {
    const dbName = `project-document-migration-${sequence++}`
    const legacy = createIndexedDBWorkspaceApplicationRepository({ dbName })
    closeables.push(legacy)
    const application = migrateWorkspaceProjectToApplication(createProjectFixture())
    await legacy.create(application)

    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()

    await expect(repository.get(application.id)).resolves.toMatchObject({
      createdAt: application.createdAt,
      document: {
        id: application.id,
        homePageId: 'home',
        pageOrder: ['home'],
        registryLock: {
          adapter: registryLock.adapter,
          version: registryLock.version,
          components: {},
        },
      },
      repositoryRevision: application.revision,
      updatedAt: application.updatedAt,
    })
    await expect(legacy.get(application.id)).resolves.toBeUndefined()
    expect(repository.migrationErrors).toEqual([])
  })

  it('deletes every manifest and entity record for a project', async () => {
    const dbName = `project-document-delete-${sequence++}`
    const repository = createIndexedDBProjectRepository(repositoryOptions(dbName))
    closeables.push(repository)
    await repository.open()
    const initial = projectDocument()
    const created = await repository.create({ document: initial })
    await repository.commit({
      commandId: 'save-before-delete',
      document: rename(initial, 'Landing'),
      expectedRepositoryRevision: created.repositoryRevision,
      id: initial.id,
    })

    await repository.delete(initial.id)
    await expect(repository.get(initial.id)).resolves.toBeUndefined()
    const storage = new IndexDBStorage({ dbName, storeName: 'workspace-projects' })
    closeables.push(storage)
    expect((await storage.keys()).filter(key => key.includes('project-document:'))).toEqual([])
  })
})
