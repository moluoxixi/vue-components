import type {
  ProjectCommand,
  ProjectDocument,
  ProjectRepository,
  ProjectRepositoryCommitInput,
  ProjectRepositoryCommitResult,
} from '@moluoxixi/config-form-model'
import { createMemoryProjectRepository, ProjectRepositoryError } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createProjectEditorSession, openProjectEditorSession } from '..'

function projectDocument(): ProjectDocument {
  return {
    version: 4,
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
          root: [],
          nodesById: {},
        },
      },
    },
    registryLock: {
      adapter: 'element-plus',
      version: '2.9.1',
      fingerprint: 'fnv1a:registry',
      components: {},
    },
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
      operations: [{ type: 'page.rename', pageId: 'home', name }],
    }],
    ...(mergeKey ? { mergeKey } : {}),
  }
}

describe('projectEditorSession', () => {
  it('keeps edits made during save outside the captured commit and merge group', async () => {
    const durable = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await durable.create({ document: initial })
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
    session.execute(renameCommand('label-a', 'Landing', 'page:home:name'))

    const savePromise = session.save({ source: 'manual', sealHistoryGroup: true })
    expect(session.snapshot.saving).toBe(true)
    session.execute(renameCommand('label-b', 'Landing updated', 'page:home:name'))
    releaseCommit()

    const saved = await savePromise
    expect(saved).toMatchObject({ success: true, newerEdits: true, repositoryRevision: 1 })
    expect((await durable.get(initial.id))?.document.pagesById.home?.name).toBe('Landing')
    expect(session.snapshot.document.pagesById.home?.name).toBe('Landing updated')
    expect(session.snapshot.dirty).toBe(true)
    expect(session.snapshot).not.toHaveProperty('currentPageId')

    expect(session.undo().changed).toBe(true)
    expect(session.snapshot.document.pagesById.home?.name).toBe('Landing')
    expect(session.snapshot.dirty).toBe(false)
  })

  it('surfaces repository conflicts without losing the local project', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    const project = await repository.create({ document: initial })
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
    expect(session.snapshot.document.pagesById.home?.name).toBe('Local')
    expect(session.snapshot.dirty).toBe(true)
    expect((await repository.get(initial.id))?.document.pagesById.home?.name).toBe('Remote')
  })

  it('opens repository documents and rejects missing projects', async () => {
    const repository = createMemoryProjectRepository()
    const initial = projectDocument()
    await repository.create({ document: initial })
    const session = await openProjectEditorSession({ projectId: initial.id, repository })
    expect(session.snapshot.document).toEqual(initial)

    await expect(openProjectEditorSession({ projectId: 'missing', repository }))
      .rejects
      .toBeInstanceOf(ProjectRepositoryError)
  })
})
