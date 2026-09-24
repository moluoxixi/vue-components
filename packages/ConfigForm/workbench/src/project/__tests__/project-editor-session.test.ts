import type {
  ProjectCommand,
  ProjectDocument,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
} from '@moluoxixi/config-form-model'
import {
  createMemoryProjectRepository,
  PROJECT_DOCUMENT_VERSION,
  ProjectRepositoryError,
  registryLockFingerprint,
  SURFACE_GRAPH_VERSION,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createProjectEditorSession, openProjectEditorSession } from '..'

function projectDocument(): ProjectDocument {
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'project',
    name: 'Project',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        name: 'Home',
        kind: 'page',
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
    datasetOrder: [],
    datasetsById: {},
    registryLock: {
      adapter: 'element-plus',
      version: '2.9.1',
      fingerprint: registryLockFingerprint({}),
      components: {},
    },
    theme: { version: 1 },
    settings: {},
    resources: {},
  }
}

function renameCommand(
  id: string,
  name: string,
  mergeKey?: string,
): ProjectCommand {
  return {
    id,
    label: 'Rename page',
    actions: [{
      type: 'operation.apply',
      operations: [{ type: 'surface.rename', surfaceId: 'home', name }],
    }],
    ...(mergeKey ? { mergeKey } : {}),
  }
}

describe('projectEditorSession', () => {
  it('keeps edits made during save outside the captured commit and merge group', async () => {
    const durable = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await durable.create({ document: initial, embeddedContents: [] })
    let releaseCommit!: () => void
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const repository: ProjectRepository = {
      persistence: durable.persistence,
      close: () => durable.close(),
      create: document => durable.create(document),
      delete: id => durable.delete(id),
      get: id => durable.get(id),
      getVersion: (id, revision) => durable.getVersion(id, revision),
      list: () => durable.list(),
      listVersions: id => durable.listVersions(id),
      pruneVersions: (id, policy) => durable.pruneVersions(id, policy),
      readEmbedded: input => durable.readEmbedded(input),
      setVersionLabel: input => durable.setVersionLabel(input),
      async commit(input: ProjectRepositoryCommitInput): Promise<ProjectRepositoryCommitResult> {
        await commitGate
        return durable.commit(input)
      },
    }
    const session = createProjectEditorSession({
      project,
      repository,
      createCommitId: () => 'save-captured',
      nowMs: () => 100,
    })
    session.execute(renameCommand('label-a', 'Landing', 'surface:home:name'))

    const savePromise = session.save({ source: 'manual', sealHistoryGroup: true })
    expect(session.snapshot.saving).toBe(true)
    session.execute(renameCommand('label-b', 'Landing updated', 'surface:home:name'))
    releaseCommit()

    const saved = await savePromise
    expect(saved).toMatchObject({ success: true, newerEdits: true, repositoryRevision: 1 })
    expect((await durable.get(initial.id))?.document.surfacesById.home?.name).toBe('Landing')
    expect(session.snapshot.document.surfacesById.home?.name).toBe('Landing updated')
    expect(session.snapshot.dirty).toBe(true)
    expect(session.snapshot).not.toHaveProperty('currentSurfaceId')

    expect(session.undo().changed).toBe(true)
    expect(session.snapshot.document.surfacesById.home?.name).toBe('Landing')
    expect(session.snapshot.dirty).toBe(false)
  })

  it('surfaces repository conflicts without losing the local project', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await repository.create({ document: initial, embeddedContents: [] })
    const session = createProjectEditorSession({ project, repository })
    session.execute(renameCommand('local-edit', 'Local'))
    const remote = createProjectEditorSession({ project, repository })
    remote.execute(renameCommand('remote-edit', 'Remote'))
    expect((await remote.save({ source: 'manual', sealHistoryGroup: true })).success).toBe(true)

    const saved = await session.save({ source: 'manual', sealHistoryGroup: true })
    expect(saved.success).toBe(false)
    if (saved.success)
      return
    expect(saved.error.code).toBe('PROJECT_REVISION_CONFLICT')
    expect(session.snapshot.document.surfacesById.home?.name).toBe('Local')
    expect(session.snapshot.dirty).toBe(true)
    expect((await repository.get(initial.id))?.document.surfacesById.home?.name).toBe('Remote')
  })

  it('stages embedded bytes with their command until the document is saved', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await repository.create({ document: initial, embeddedContents: [] })
    const session = createProjectEditorSession({ project, repository })
    const bytes = new Uint8Array([1, 2, 3])
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const contentHash = `sha256:${[...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')}`
    const write = { resourceId: 'logo', contentHash, bytes }

    const result = session.execute({
      id: 'import-resource',
      label: 'Import Resource',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'resource.add',
          resource: {
            id: 'logo',
            name: 'Logo',
            kind: 'embedded',
            fileName: 'logo.bin',
            mediaType: 'application/octet-stream',
            byteLength: bytes.byteLength,
            contentHash,
          },
        }],
      }],
    }, { embeddedWrites: [write] })
    write.bytes[0] = 9

    expect(result.changed).toBe(true)
    await expect(session.readEmbedded({
      projectId: initial.id,
      resourceId: 'logo',
      contentHash,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))
    expect((await session.save({ source: 'manual', sealHistoryGroup: true })).success).toBe(true)
    await expect(repository.readEmbedded({
      projectId: initial.id,
      resourceId: 'logo',
      contentHash,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))

    expect(session.undo().changed).toBe(true)
    expect(session.snapshot.document.resources).toEqual({})
  })

  it('publishes one snapshot for a batched multi-dispatch history walk', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await repository.create({ document: initial, embeddedContents: [] })
    const session = createProjectEditorSession({ project, repository })
    session.execute(renameCommand('edit-a', 'First'))
    session.execute(renameCommand('edit-b', 'Second'))
    session.execute(renameCommand('edit-c', 'Third'))

    const published: Array<{ name: string | undefined, precise: boolean }> = []
    const unsubscribe = session.subscribe((snapshot, changeSet) => {
      published.push({
        name: snapshot.document.surfacesById.home?.name,
        precise: changeSet.surfaceIds.length > 0,
      })
    })
    published.length = 0

    const result = session.batch(() => {
      expect(session.undo().changed).toBe(true)
      expect(session.undo().changed).toBe(true)
      return 'landed'
    })
    expect(result).toBe('landed')
    expect(published).toEqual([{ name: 'First', precise: false }])

    published.length = 0
    session.batch(() => {
      expect(session.redo().changed).toBe(true)
    })
    expect(published).toEqual([{ name: 'Second', precise: true }])

    published.length = 0
    session.batch(() => {})
    expect(published).toEqual([])
    unsubscribe()
  })

  it('opens repository documents and rejects missing projects', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    await repository.create({ document: initial, embeddedContents: [] })
    const session = await openProjectEditorSession({ projectId: initial.id, repository })
    expect(session.snapshot.document).toEqual(initial)

    await expect(openProjectEditorSession({ projectId: 'missing', repository }))
      .rejects
      .toBeInstanceOf(ProjectRepositoryError)
  })
})
