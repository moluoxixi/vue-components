import type { WorkspaceApplicationRepository } from '../../project/application-repository'
import { createLowCodeComponentRegistry } from '@moluoxixi/config-form-designer'
import { createElementPlusDesignerRegistry } from '@moluoxixi/config-form-designer-element-plus'
import { describe, expect, it } from 'vitest'
import { createProjectFixture, NEXT_TIME } from '../../project/__tests__/fixtures'
import {
  applyWorkspaceApplicationOperation,
  duplicateWorkspacePage,
  migrateWorkspaceProjectToApplication,
} from '../../project/application'
import { createMemoryWorkspaceApplicationRepository } from '../../project/application-repository'
import { createWorkspaceSession } from '../workspace-session'

const registry = createLowCodeComponentRegistry(createElementPlusDesignerRegistry())

async function createFixtureSession(options: {
  repository?: WorkspaceApplicationRepository
  now?: () => number
} = {}) {
  const application = migrateWorkspaceProjectToApplication(createProjectFixture())
  const repository = options.repository ?? createMemoryWorkspaceApplicationRepository({ now: () => NEXT_TIME })
  await repository.create(application)
  const session = createWorkspaceSession({
    application,
    registry,
    repository,
    ...(options.now ? { now: options.now } : {}),
  })
  return { application, repository, session }
}

describe('workspace session transactions', () => {
  it('commits cross-layer operations atomically and advances one model revision', async () => {
    const { session } = await createFixtureSession()
    const initialRevision = session.snapshot.modelRevision
    const result = session.dispatch({
      id: 'configure-home',
      label: 'Configure home',
      operations: [
        {
          type: 'page.model',
          pageId: 'home',
          operation: { type: 'updatePage', form: {}, props: { layout: 'horizontal' } },
        },
        {
          type: 'application',
          operation: { type: 'rename-page', pageId: 'home', name: 'Overview' },
        },
      ],
    })

    expect(result.changed).toBe(true)
    expect(result.snapshot.modelRevision).toBe(initialRevision + 1)
    expect(result.snapshot.currentPage).toMatchObject({ name: 'Overview' })
    expect(result.snapshot.currentPage.model.props).toEqual({ layout: 'horizontal' })
    expect(result.snapshot.dirty).toBe(true)
  })

  it('rolls back the whole transaction when a later operation fails', async () => {
    const { session } = await createFixtureSession()
    const before = session.snapshot
    const result = session.dispatch({
      id: 'invalid-batch',
      label: 'Invalid batch',
      operations: [
        {
          type: 'page.model',
          pageId: 'home',
          operation: { type: 'updatePage', form: {}, props: { changed: true } },
        },
        {
          type: 'application',
          operation: { type: 'rename-page', pageId: 'missing', name: 'Missing' },
        },
      ],
    })

    expect(result.changed).toBe(false)
    expect(result.diagnostics[0]).toMatchObject({ operationIndex: 1 })
    expect(result.snapshot.application).toEqual(before.application)
    expect(result.snapshot.modelRevision).toBe(before.modelRevision)
    expect(result.snapshot.dirty).toBe(false)
  })

  it('undoes and redoes transactions across pages while page switching stays transient', async () => {
    const { application, session } = await createFixtureSession()
    const settings = duplicateWorkspacePage(application.pages[0]!, {
      id: 'settings',
      name: 'Settings',
      route: '/settings',
    })
    session.dispatch({
      id: 'add-settings',
      label: 'Add settings',
      operations: [{ type: 'application', operation: { type: 'add-page', page: settings } }],
    })
    session.setCurrentPage('settings')
    session.dispatch({
      id: 'configure-settings',
      label: 'Configure settings',
      operations: [{
        type: 'page.model',
        pageId: 'settings',
        operation: { type: 'updatePage', form: {}, props: { density: 'compact' } },
      }],
    })

    expect(session.undo().snapshot.currentPageId).toBe('settings')
    expect(session.snapshot.currentPage.model.props).toEqual({})
    expect(session.undo().snapshot.application.pages.map(page => page.id)).toEqual(['home'])
    expect(session.snapshot.currentPageId).toBe('home')
    expect(session.redo().snapshot.application.pages.map(page => page.id)).toEqual(['home', 'settings'])
    expect(session.redo().snapshot.currentPage.model.props).toEqual({ density: 'compact' })
  })

  it('coalesces adjacent transactions with the same merge key into one undo entry', async () => {
    let timestamp = 100
    const { session } = await createFixtureSession({ now: () => timestamp })
    for (const [value, advance] of [['A', 0], ['AB', 100]] as const) {
      timestamp += advance
      session.dispatch({
        id: `rename-${value}`,
        label: 'Rename page',
        mergeKey: 'page:home:name',
        operations: [{
          type: 'application',
          operation: { type: 'rename-page', pageId: 'home', name: value },
        }],
      })
    }

    expect(session.snapshot.currentPage.name).toBe('AB')
    expect(session.undo().snapshot.currentPage.name).toBe('Fixture project')
    expect(session.snapshot.canUndo).toBe(false)
  })

  it('records one semantic flow operation as one undoable transaction', async () => {
    const { session } = await createFixtureSession()
    const flow = {
      version: 1 as const,
      id: 'submit-flow',
      name: 'Submit flow',
      trigger: { kind: 'form.submit' as const },
      nodes: [
        { id: 'trigger', type: 'trigger' as const },
        { id: 'end', type: 'end' as const },
      ],
      edges: [{ id: 'next', source: 'trigger', target: 'end', condition: 'next' as const }],
    }

    const result = session.dispatch({
      id: 'add-submit-flow',
      label: 'Add submit flow',
      operations: [{
        type: 'page.model',
        pageId: 'home',
        operation: { type: 'addFlow', flow },
      }],
    })

    expect(result.changed).toBe(true)
    expect(result.snapshot.currentPage.model.flows).toEqual([flow])
    expect(session.undo().snapshot.currentPage.model).not.toHaveProperty('flows')
    expect(session.snapshot.canUndo).toBe(false)
    expect(session.redo().snapshot.currentPage.model.flows).toEqual([flow])
  })
})

describe('workspace session persistence', () => {
  it('keeps edits made during an in-flight save dirty on the committed repository revision', async () => {
    const baseRepository = createMemoryWorkspaceApplicationRepository({ now: () => NEXT_TIME })
    let releaseCommit!: () => void
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const repository: WorkspaceApplicationRepository = {
      ...baseRepository,
      close: () => baseRepository.close(),
      commit: async (...args) => {
        await commitGate
        return baseRepository.commit(...args)
      },
      create: input => baseRepository.create(input),
      delete: id => baseRepository.delete(id),
      get: id => baseRepository.get(id),
      getDraft: id => baseRepository.getDraft(id),
      list: () => baseRepository.list(),
      migrationErrors: baseRepository.migrationErrors,
      persistence: baseRepository.persistence,
      saveDraft: (id, draft) => baseRepository.saveDraft(id, draft),
    }
    const { session } = await createFixtureSession({ repository })
    session.dispatch({
      id: 'first-edit',
      label: 'First edit',
      operations: [{ type: 'application', operation: { type: 'rename-page', pageId: 'home', name: 'First' } }],
    })

    const save = session.save()
    session.dispatch({
      id: 'newer-edit',
      label: 'Newer edit',
      operations: [{ type: 'application', operation: { type: 'rename-page', pageId: 'home', name: 'Newer' } }],
    })
    releaseCommit()
    const result = await save

    expect(result).toMatchObject({ success: true, newerEdits: true, revision: 2 })
    expect(session.snapshot).toMatchObject({ applicationRevision: 2, dirty: true })
    expect(session.snapshot.currentPage.name).toBe('Newer')
  })

  it('reports revision conflicts without clearing local edits', async () => {
    const { application, repository, session } = await createFixtureSession()
    session.dispatch({
      id: 'local-edit',
      label: 'Local edit',
      operations: [{ type: 'application', operation: { type: 'rename-page', pageId: 'home', name: 'Local' } }],
    })
    const external = applyWorkspaceApplicationOperation(application, {
      type: 'rename-page',
      pageId: 'home',
      name: 'External',
    })
    await repository.commit(application.id, application.revision, external)

    const result = await session.save()

    expect(result).toMatchObject({
      success: false,
      error: { code: 'PROJECT_REVISION_CONFLICT' },
    })
    expect(session.snapshot.dirty).toBe(true)
    expect(session.snapshot.currentPage.name).toBe('Local')
  })
})
