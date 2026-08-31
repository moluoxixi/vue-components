import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type {
  ProjectEditorSession,
  ProjectEditorSessionDispatchResult,
  ProjectEditorSessionSnapshot,
} from '../../project'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProject } from '../../project'
import { createWorkbenchDesignSession } from '../workbench-design-session'
import { createWorkbenchExportService } from '../workbench-export-service'

async function fixture() {
  const adapter = await loadWorkbenchAdapter('element-plus')
  const document = createBuiltInProject('element-profile', {
    id: 'workbench-services',
    name: 'Workbench services',
  }, adapter.componentRegistry.lock)
  const project = createProjectSnapshot(document, 3)
  const snapshot: ProjectEditorSessionSnapshot = {
    ...project,
    canRedo: false,
    canUndo: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    dirty: true,
    persistence: 'durable',
    repositoryRevision: 2,
    saving: false,
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
  return { adapter, document, snapshot }
}

function sessionResult(snapshot: ProjectEditorSessionSnapshot): ProjectEditorSessionDispatchResult {
  return {
    changed: true,
    changeSet: { project: false, pageIds: ['home'], nodeIds: [], nodeChanges: [] },
    diagnostics: [],
    snapshot,
  }
}

describe('workbench service boundaries', () => {
  it('publishes compilation failures instead of leaving an unexplained blank canvas', async () => {
    const { snapshot } = await fixture()
    let diagnostic = ''
    const design = createWorkbenchDesignSession({
      getAdapter: () => undefined,
      getPageId: () => 'home',
      getProjectSession: () => undefined,
      getSnapshot: () => snapshot,
      setDiagnostic: message => diagnostic = message,
    })

    const publication = design.accept(snapshot, 'home')

    expect(publication.runtime).toMatchObject({ success: false })
    expect(design.compilation.value).toBeUndefined()
    expect(design.runtime.value).toBeUndefined()
    expect(diagnostic).toBe('Workbench runtime adapter is unavailable.')
  })

  it('keeps compilation candidates and command history inside Design Session', async () => {
    const { adapter, document, snapshot } = await fixture()
    const execute = vi.fn(() => sessionResult(snapshot))
    const undo = vi.fn(() => sessionResult(snapshot))
    const redo = vi.fn(() => sessionResult(snapshot))
    const projectSession = {
      snapshot,
      execute,
      undo,
      redo,
    } as unknown as ProjectEditorSession
    let diagnostic = 'stale'
    const design = createWorkbenchDesignSession({
      getAdapter: () => adapter,
      getPageId: () => 'home',
      getProjectSession: () => projectSession,
      getSnapshot: () => snapshot,
      setDiagnostic: message => diagnostic = message,
    })
    design.configure(adapter)
    const publication = design.accept(snapshot, 'home')
    expect(publication.compilation).toBe(design.compilation.value)
    expect(publication.runtime.success).toBe(true)
    expect(design.runtime.value).toBe(publication.runtime)

    const field = Object.values(document.pagesById.home!.graph.nodesById)
      .find(node => node.kind === 'field')!
    const command: ProjectCommand = {
      id: 'candidate-label',
      label: 'Candidate label',
      actions: [{
        type: 'node.patch',
        pageId: 'home',
        nodeId: field.id,
        patch: { set: { label: 'Candidate label' } },
      }],
    }
    const candidate = design.getCompilation(command)
    expect(candidate?.snapshotIdentity).toMatchObject({ source: 'draft' })
    expect(snapshot.document.pagesById.home!.graph.nodesById[field.id]).not.toHaveProperty('label', 'Candidate label')
    expect(design.commandControl.preview(command)?.graph.nodesById[field.id]).toMatchObject({ label: 'Candidate label' })

    expect(design.commandControl.execute(command).changed).toBe(true)
    expect(execute).toHaveBeenCalledOnce()
    expect(design.historyControl.value.undo()).toBe(true)
    expect(design.historyControl.value.redo()).toBe(true)
    expect(undo).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
    expect(diagnostic).toBe('')

    design.dispose()
    expect(design.compilation.value).toBeUndefined()
    expect(design.runtime.value).toBeUndefined()
  })

  it('keeps full-project compilation lazy and snapshot-scoped in Export Service', async () => {
    const { adapter, snapshot } = await fixture()
    let current = snapshot
    const service = createWorkbenchExportService({
      getAdapter: () => adapter,
      getSnapshot: () => current,
    })

    service.sync(snapshot)
    expect(service.compilation.value).toBeUndefined()
    const first = service.capture()
    expect(first?.compilation.origin).toEqual({ kind: 'committed', editVersion: 3 })
    expect(service.getCompilation()).toBe(first?.compilation)
    expect(service.capture()?.compilation).toBe(first?.compilation)

    current = {
      ...snapshot,
      editVersion: 4,
    }
    service.sync(current)
    expect(service.getCompilation()).toBeUndefined()
    const refreshed = service.capture()
    expect(refreshed?.compilation.origin).toEqual({ kind: 'committed', editVersion: 4 })
    expect(refreshed?.compilation).not.toBe(first?.compilation)
  })
})
