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
  }
}

describe('candidate previews after layout inserts', () => {
  it('keeps insert previews alive after an empty section lands through incremental compilation', async () => {
    const adapter = await loadWorkbenchAdapter('element-plus')
    const document = createBuiltInProjectFixture('element-profile', { id: 'repro', name: 'Repro' }, adapter.componentRegistry.lock)
    const surfaceId = document.homeSurfaceId
    let snapshot = editorSnapshot(createProjectSnapshot(document, 3))
    const design = createWorkbenchDesignSession({
      getAdapter: () => adapter,
      getSurfaceId: () => surfaceId,
      getProjectSession: () => undefined,
      getSnapshot: () => snapshot,
      setDiagnostic: () => {},
    })
    design.configure(adapter)
    expect(design.accept(snapshot, surfaceId).runtime.success).toBe(true)

    // evolve the document: empty section appended at root end
    const surface = document.surfacesById[surfaceId]!
    const next = {
      ...document,
      surfacesById: {
        ...document.surfacesById,
        [surfaceId]: {
          ...surface,
          graph: {
            ...surface.graph,
            nodesById: {
              ...surface.graph.nodesById,
              'sec-1': { id: 'sec-1', kind: 'layout' as const, component: 'element.section', props: { title: 'Section' }, slots: { default: [] } },
            },
            root: [...surface.graph.root, { nodeId: 'sec-1', placement: {} }],
          },
        },
      },
    }
    snapshot = editorSnapshot(createProjectSnapshot(next, 4))
    const accepted = design.accept(snapshot, surfaceId, {
      project: false,
      surfaceIds: [surfaceId],
      datasetIds: [],
      resourceIds: [],
      nodeChanges: [{
        surfaceId,
        nodeId: 'sec-1',
        kind: 'insert',
        after: { parentId: null, slot: null },
      }],
    })
    expect(accepted.runtime.success).toBe(true)

    const inputInsert: ProjectCommand = {
      id: 'candidate-insert-x',
      label: 'Insert input',
      actions: [{
        type: 'operation.apply',
        operations: [{
          type: 'node.insert',
          surfaceId,
          subgraph: {
            root: [{ nodeId: 'cand-1', placement: {} }],
            nodesById: { 'cand-1': { id: 'cand-1', kind: 'field', component: 'element.input', field: 'cand_1', props: {} } },
          },
          target: { parentId: null, index: next.surfacesById[surfaceId]!.graph.root.length },
        }],
      }],
    }
    expect(design.commandControl.preview(inputInsert)).toBeDefined()
  })
})
