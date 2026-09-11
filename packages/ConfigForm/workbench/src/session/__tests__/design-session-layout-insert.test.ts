import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { ProjectEditorSessionSnapshot } from '../../project'
import { createProjectSnapshot } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { createWorkbenchDesignSession } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createBuiltInProjectFixture } from '../../project/__tests__/fixtures'

function editorSnapshot(project: ReturnType<typeof createProjectSnapshot>): ProjectEditorSessionSnapshot {
  return {
    ...project,
    canRedo: false,
    canUndo: true,
    createdAt: '2026-08-31T00:00:00.000Z',
    dirty: true,
    history: { entries: [], limit: 100, position: 0 },
    persistence: 'durable',
    repositoryRevision: 2,
    saving: false,
    updatedAt: '2026-08-31T00:00:00.000Z',
  } as ProjectEditorSessionSnapshot
}

describe('candidate previews after layout inserts', () => {
  it('keeps insert previews alive after an empty section lands through incremental compilation', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const document = createBuiltInProjectFixture('element-profile', { id: 'repro', name: 'Repro' }, adapter.componentRegistry.lock)
    let snapshot = editorSnapshot(createProjectSnapshot(document, 3))
    const design = createWorkbenchDesignSession({
      getAdapter: () => adapter,
      getPageId: () => 'home',
      getProjectSession: () => undefined,
      getSnapshot: () => snapshot,
      setDiagnostic: () => {},
    })
    design.configure(adapter)
    expect(design.accept(snapshot, 'home').runtime.success).toBe(true)

    // evolve the document: empty section appended at root end
    const page = document.pagesById.home!
    const next = {
      ...document,
      pagesById: {
        ...document.pagesById,
        home: {
          ...page,
          graph: {
            ...page.graph,
            nodesById: {
              ...page.graph.nodesById,
              'sec-1': { id: 'sec-1', kind: 'layout' as const, component: 'element.section', props: { title: 'Section' }, events: {}, bindings: {}, slots: { default: [] } },
            },
            root: [...page.graph.root, { nodeId: 'sec-1', placement: {} }],
          },
        },
      },
    }
    snapshot = editorSnapshot(createProjectSnapshot(next, 4))
    const accepted = design.accept(snapshot, 'home', { project: false, pageIds: ['home'], nodeIds: ['sec-1'], nodeChanges: [{ pageId: 'home', nodeId: 'sec-1', kind: 'insert', after: { parentId: null } }] } as never)
    expect(accepted.runtime.success).toBe(true)

    const inputInsert: ProjectCommand = {
      id: 'candidate-insert-x',
      label: 'Insert input',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'node.insert',
          pageId: 'home',
          subgraph: {
            root: [{ nodeId: 'cand-1', placement: {} }],
            nodesById: { 'cand-1': { id: 'cand-1', kind: 'field', component: 'element.input', field: 'cand_1', props: {}, events: {}, bindings: {} } },
          },
          target: { parentId: null, index: next.pagesById.home!.graph.root.length },
        }],
      }] as never,
    }
    expect(design.commandControl.preview(inputInsert)).toBeDefined()
  })
})
