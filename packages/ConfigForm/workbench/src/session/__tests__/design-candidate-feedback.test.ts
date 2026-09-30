import type { ProjectCommand } from '@moluoxixi/config-form-model'
import type { ProjectEditorSessionSnapshot } from '../../project'
import { createMemoryProjectRepository } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { createWorkbenchDesignSession } from '..'
import { loadWorkbenchAdapter } from '../../adapters'
import { createProjectEditorSession } from '../../project'
import { createBuiltInProjectFixture } from '../../project/__tests__/fixtures'

async function fixture() {
  const source = await loadWorkbenchAdapter('element-plus')
  const resolveBinding = vi.fn(source.runtimeResolver.resolveBinding)
  const analyzeLock = vi.fn(source.componentRegistry.analyzeLock)
  const adapter = {
    ...source,
    componentRegistry: { ...source.componentRegistry, analyzeLock },
    runtimeResolver: { ...source.runtimeResolver, resolveBinding },
  }
  const document = createBuiltInProjectFixture('element-profile', { id: 'candidate-feedback', name: 'Candidate feedback' }, adapter.componentRegistry.lock)
  const repository = createMemoryProjectRepository()
  const project = await repository.create({ document, embeddedContents: [] })
  const editor = createProjectEditorSession({ project, repository, registry: adapter.componentRegistry })
  let snapshot: ProjectEditorSessionSnapshot = editor.snapshot
  const setDiagnostic = vi.fn()
  const design = createWorkbenchDesignSession({
    getAdapter: () => adapter,
    getSurfaceId: () => document.homeSurfaceId,
    getProjectSession: () => editor,
    getSnapshot: () => snapshot,
    setDiagnostic,
  })
  design.configure(adapter)
  editor.subscribe((next, changeSet) => {
    snapshot = next
    design.accept(next, document.homeSurfaceId, changeSet)
  })
  const field = Object.values(document.surfacesById[document.homeSurfaceId]!.graph.nodesById).find(node => node.kind === 'field')!
  const command: ProjectCommand = {
    id: 'candidate-label',
    label: 'Candidate label',
    actions: [{ type: 'node.patch', surfaceId: document.homeSurfaceId, nodeId: field.id, patch: { set: { label: 'Candidate label' } } }],
  }
  return { adapter, analyzeLock, command, design, document, editor, repository, resolveBinding, setDiagnostic }
}

describe('recoverable candidate feedback', () => {
  it('keeps invalid and no-op candidates quiet', async () => {
    const { command, design } = await fixture()
    expect(design.commandControl.preview({ ...command, actions: [] })).toBeUndefined()
    expect(design.getCompilation({
      ...command,
      actions: [{ type: 'node.patch', surfaceId: 'missing', nodeId: 'missing', patch: { set: { label: 'Invalid' } } }],
    })).toBeUndefined()
    expect(design.candidateDiagnostic.value).toBeUndefined()
  })

  it('reports unexpected errors, keeps the committed artifact, and retries the exact same command', async () => {
    const { analyzeLock, command, design, editor, setDiagnostic } = await fixture()
    const before = editor.snapshot
    const compilation = design.compilation.value
    const runtime = design.runtime.value
    setDiagnostic.mockClear()
    analyzeLock.mockImplementationOnce(() => {
      throw new Error('Registry temporarily unavailable')
    })

    expect(design.commandControl.preview(command)).toBeUndefined()
    expect(design.candidateDiagnostic.value).toMatchObject({
      code: 'WORKBENCH_CANDIDATE_FAILED',
      message: 'Registry temporarily unavailable',
      context: { commandId: command.id },
    })
    expect(editor.snapshot).toEqual(before)
    expect(design.compilation.value).toBe(compilation)
    expect(design.runtime.value).toBe(runtime)
    expect(setDiagnostic).not.toHaveBeenCalled()

    expect(design.commandControl.preview(command)).toBeDefined()
    expect(design.candidateDiagnostic.value).toBeUndefined()
  })

  it('reports compiler diagnostics without caching a failed candidate or blocking a save', async () => {
    const { command, design, document, editor, repository, resolveBinding, setDiagnostic } = await fixture()
    editor.execute({ id: 'rename-project', label: 'Rename project', actions: [{ type: 'operation.apply', operations: [{ type: 'project.rename', name: 'Saved after preview error' }] }] })
    setDiagnostic.mockClear()
    resolveBinding.mockReturnValueOnce(undefined)
    expect(design.getCompilation(command)).toBeUndefined()
    expect(design.candidateDiagnostic.value?.code).toBe('WORKBENCH_CANDIDATE_COMPILE_FAILED')
    expect(setDiagnostic).not.toHaveBeenCalled()
    expect(design.getCompilation(command)).toBeDefined()
    expect(design.candidateDiagnostic.value).toBeUndefined()
    resolveBinding.mockReturnValueOnce(undefined)
    expect(design.getCompilation({
      ...command,
      id: 'candidate-before-save',
      actions: [{
        type: 'node.patch',
        surfaceId: document.homeSurfaceId,
        nodeId: Object.values(document.surfacesById[document.homeSurfaceId]!.graph.nodesById).find(node => node.kind === 'field')!.id,
        patch: { set: { label: 'Candidate before save' } },
      }],
    })).toBeUndefined()
    expect(design.candidateDiagnostic.value?.code).toBe('WORKBENCH_CANDIDATE_COMPILE_FAILED')
    expect((await editor.save({ source: 'manual', sealHistoryGroup: true })).success).toBe(true)
    expect((await repository.get(document.id))?.document.name).toBe('Saved after preview error')
    expect(design.getCompilation(command)).toBeDefined()
    expect(design.candidateDiagnostic.value).toBeUndefined()
  })

  it('clears transient feedback on a committed state, clear, and reconfiguration', async () => {
    const { adapter, analyzeLock, command, design, editor } = await fixture()
    function failPreview() {
      analyzeLock.mockImplementationOnce(() => {
        throw new Error('Temporary candidate failure')
      })
      expect(design.commandControl.preview(command)).toBeUndefined()
      expect(design.candidateDiagnostic.value).toBeDefined()
    }
    failPreview()
    editor.execute({ id: 'commit-after-candidate', label: 'Rename project', actions: [{ type: 'operation.apply', operations: [{ type: 'project.rename', name: 'Changed project' }] }] })
    expect(design.candidateDiagnostic.value).toBeUndefined()
    failPreview()
    design.clear()
    expect(design.candidateDiagnostic.value).toBeUndefined()
    design.configure(adapter)
    design.accept(editor.snapshot, editor.snapshot.document.homeSurfaceId)
    failPreview()
    design.configure(adapter)
    expect(design.candidateDiagnostic.value).toBeUndefined()
  })

  it('keeps identical failure feedback stable while allowing an uncached retry', async () => {
    const { analyzeLock, command, design } = await fixture()
    analyzeLock.mockImplementation(() => {
      throw new Error('Candidate resolver failed')
    })
    expect(design.commandControl.preview(command)).toBeUndefined()
    const first = design.candidateDiagnostic.value
    expect(first).toBeDefined()
    expect(design.getCompilation(command)).toBeUndefined()
    expect(design.candidateDiagnostic.value).toBe(first)
    analyzeLock.mockReturnValue([])
    expect(design.commandControl.preview(command)).toBeDefined()
    expect(design.candidateDiagnostic.value).toBeUndefined()
  })

  it('recompiles only the final history state and invalidates cached candidates', async () => {
    const { command, design, document, editor } = await fixture()
    const field = Object.values(document.surfacesById[document.homeSurfaceId]!.graph.nodesById).find(node => node.kind === 'field')!
    const originalLabel = field.label
    for (const label of ['First', 'Second', 'Third']) {
      expect(editor.execute({
        id: label,
        label,
        actions: [{ type: 'node.patch', surfaceId: document.homeSurfaceId, nodeId: field.id, patch: { set: { label } } }],
      }).changed).toBe(true)
    }
    const cached = design.getCompilation(command)
    const published = vi.fn(() => design.compilation.value?.surface.nodesById[field.id])
    editor.subscribe(published)
    published.mockClear()
    expect(design.historyControl.value.jump(0)).toBe(true)
    expect(published).toHaveBeenCalledOnce()
    expect(published.mock.results[0]?.value).toMatchObject({ label: originalLabel })
    expect(editor.snapshot.dirty).toBe(false)
    const candidate = design.getCompilation(command)
    expect(candidate).toBeDefined()
    expect(candidate).not.toBe(cached)
    expect(candidate?.snapshotIdentity).toMatchObject({ baseEditVersion: editor.snapshot.editVersion })
    published.mockClear()
    expect(design.historyControl.value.jump(3)).toBe(true)
    expect(published).toHaveBeenCalledOnce()
    expect(published.mock.results[0]?.value).toMatchObject({ label: 'Third' })
  })
})
