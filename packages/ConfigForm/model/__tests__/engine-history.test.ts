import type { ModelDiagnostic, ProjectCommand } from '../index'
import { describe, expect, it, vi } from 'vitest'
import { createComponentContractRegistry, createProjectDomainEngine } from '../index'
import { documentFixture, pageSurface } from './test-fixtures'

function rename(id: string, name: string): ProjectCommand {
  return {
    id,
    label: `Rename ${name}`,
    actions: [{ type: 'operation.apply', operations: [{ type: 'surface.rename', surfaceId: 'home', name }] }],
  }
}

function fixture() {
  const contracts = createComponentContractRegistry([], { adapter: 'test-adapter', version: '1.0.0' })
  const analyzeLock = vi.fn(contracts.analyzeLock)
  const engine = createProjectDomainEngine({
    document: documentFixture({
      registryLock: contracts.lock,
      surfacesById: { home: pageSurface('home', '/', {}, []) },
    }),
    registry: { ...contracts, analyzeLock },
    nowMs: () => 100,
  })
  for (const name of ['First', 'Second', 'Third'])
    expect(engine.execute(rename(name, name)).changed).toBe(true)
  return { engine, analyzeLock }
}

describe('atomic domain history traversal', () => {
  it('rejects invalid positions and leaves a no-op unpublished', () => {
    const { engine } = fixture()
    const before = engine.snapshot
    const listener = vi.fn()
    engine.subscribe(listener)
    listener.mockClear()
    for (const position of [-1, 4, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = engine.jump(position)
      expect(result.changed).toBe(false)
      expect(result.diagnostics[0]?.code).toBe('PROJECT_HISTORY_POSITION_INVALID')
      expect(result.snapshot.document).toBe(before.document)
      expect(result.snapshot).toMatchObject({ cursor: before.cursor, editVersion: before.editVersion, history: before.history })
    }
    expect(engine.jump(3)).toMatchObject({ changed: false, diagnostics: [] })
    expect(listener).not.toHaveBeenCalled()
  })

  it('publishes only the final state in both directions and preserves cursor identities', () => {
    const { engine } = fixture()
    const before = engine.snapshot
    const listener = vi.fn()
    engine.subscribe(listener)
    listener.mockClear()
    const undone = engine.jump(0)
    expect(undone.changed).toBe(true)
    expect(undone.snapshot.document.surfacesById.home?.name).toBe('Home')
    expect(undone.snapshot.history.position).toBe(0)
    expect(undone.snapshot.editVersion).toBe(before.editVersion + 3)
    expect(listener).toHaveBeenCalledExactlyOnceWith(undone.snapshot, undone.changeSet)
    listener.mockClear()
    const redone = engine.jump(3)
    expect(redone.snapshot.document).toEqual(before.document)
    expect(redone.snapshot.cursor).toBe(before.cursor)
    expect(redone.snapshot.history).toEqual(before.history)
    expect(listener).toHaveBeenCalledExactlyOnceWith(redone.snapshot, redone.changeSet)
    listener.mockClear()
    expect(engine.jump(2).changeSet.surfaceIds).toEqual(['home'])
    expect(listener).toHaveBeenCalledOnce()
  })

  it.each(['undo', 'redo'] as const)('discards a staged %s walk on intermediate validation failure', (direction) => {
    const { engine, analyzeLock } = fixture()
    if (direction === 'redo')
      expect(engine.jump(0).changed).toBe(true)
    const before = engine.snapshot
    const listener = vi.fn()
    engine.subscribe(listener)
    listener.mockClear()
    const diagnostic: ModelDiagnostic = { code: 'TEST_HISTORY_VALIDATION_FAILED', message: 'Registry validation failed.' }
    // Each rename validates the source lock and its resulting document. The
    // third check is the next traversal step, after one privately staged edit.
    analyzeLock.mockClear()
    analyzeLock.mockReturnValueOnce([]).mockReturnValueOnce([]).mockReturnValueOnce([diagnostic])
    const failed = engine.jump(direction === 'undo' ? 0 : 3)
    expect(analyzeLock).toHaveBeenCalledTimes(3)
    expect(failed).toMatchObject({ changed: false, diagnostics: [diagnostic] })
    expect(failed.snapshot.document).toBe(before.document)
    expect(failed.snapshot).toMatchObject({
      contentHash: before.contentHash,
      cursor: before.cursor,
      editVersion: before.editVersion,
      history: before.history,
      canUndo: before.canUndo,
      canRedo: before.canRedo,
    })
    expect(listener).not.toHaveBeenCalled()
    expect(engine.jump(direction === 'undo' ? 0 : 3).changed).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('reports an unexpected intermediate exception without publishing staged state', () => {
    const { engine, analyzeLock } = fixture()
    const before = engine.snapshot
    const listener = vi.fn()
    engine.subscribe(listener)
    listener.mockClear()
    analyzeLock.mockReturnValueOnce([]).mockReturnValueOnce([]).mockImplementationOnce(() => {
      throw new Error('Validator temporarily unavailable')
    })
    expect(engine.jump(0)).toMatchObject({
      changed: false,
      diagnostics: [{ code: 'PROJECT_HISTORY_JUMP_FAILED', message: 'Validator temporarily unavailable' }],
    })
    expect(engine.snapshot.document).toBe(before.document)
    expect(engine.snapshot).toMatchObject({ cursor: before.cursor, editVersion: before.editVersion, history: before.history })
    expect(listener).not.toHaveBeenCalled()
    expect(engine.jump(0).changed).toBe(true)
  })
})
