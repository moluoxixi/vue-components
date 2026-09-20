import type { ProjectDocument } from '@moluoxixi/config-form-model'
import {
  createProjectSnapshot,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  compileCanonicalProject,
  compileCanonicalSurface,
  createCompileCoordinator,
} from '../index'
import { createCompilerFixture } from './fixtures'

describe('surface Dataset and interaction projection', () => {
  it('keeps Dataset, Resource, and interaction references in the flat Surface IR', () => {
    const input = createCompilerFixture()
    const result = compileCanonicalSurface({ ...input, surfaceId: 'home' })
    expect(result.success).toBe(true)
    if (!result.success)
      return

    const surface = result.compilation.surface
    expect(surface.nodesById.name?.datasetBindings).toEqual({
      options: {
        datasetId: 'people',
        projection: { kind: 'options', labelPath: ['label'], valuePath: ['id'] },
      },
    })
    expect(result.compilation.datasetsById).toEqual({
      people: input.snapshot.document.datasetsById.people,
    })
    expect(result.compilation.theme).toEqual(input.snapshot.document.theme)
    expect(Object.isFrozen(result.compilation.theme)).toBe(true)
    expect(Object.isFrozen(result.compilation.datasetsById)).toBe(true)
    expect(surface.interactions).toEqual(input.snapshot.document.surfacesById.home!.interactions)
    expect(JSON.stringify(surface)).not.toContain('optionSource')
    expect(JSON.stringify(surface)).not.toContain('runtime')
  })

  it('rebinds a cached Surface compilation to the latest project theme', () => {
    const input = createCompilerFixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const before = coordinator.compileSurface('home')
    expect(before.success).toBe(true)
    if (!before.success)
      return

    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.theme = { version: 1, colors: { primary: '#336699' }, spacing: { md: 18 } }
    coordinator.acceptSnapshot(createProjectSnapshot(document, 2), {
      project: true,
      surfaceIds: [],
      datasetIds: [],
      resourceIds: [],
      nodeChanges: [],
    })
    const after = coordinator.compileSurface('home')
    expect(after.success).toBe(true)
    if (!after.success)
      return
    expect(after.compilation.surface).toBe(before.compilation.surface)
    expect(after.compilation.theme).toEqual(document.theme)
    expect(after.compilation.theme).not.toBe(before.compilation.theme)
  })

  it('changes Surface semantic identity when a referenced Dataset or Resource changes', () => {
    const input = createCompilerFixture()
    const base = compileCanonicalSurface({ ...input, surfaceId: 'home' })
    expect(base.success).toBe(true)
    if (!base.success)
      return

    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.datasetsById.people!.rows = [{ id: 'grace', label: 'Grace' }]
    const datasetResult = compileCanonicalSurface({
      ...input,
      snapshot: createProjectSnapshot(document, 2),
      surfaceId: 'home',
    })
    expect(datasetResult.success).toBe(true)
    if (!datasetResult.success)
      return
    expect(datasetResult.compilation.key.semanticHash).not.toBe(base.compilation.key.semanticHash)
  })

  it('invalidates only directly affected Dataset consumers in the coordinator', () => {
    const input = createCompilerFixture()
    const coordinator = createCompileCoordinator({ registry: input.registry })
    coordinator.acceptSnapshot(input.snapshot)
    const home = coordinator.compileSurface('home')
    const editor = coordinator.compileSurface('editor')
    expect(home.success && editor.success).toBe(true)
    if (!home.success || !editor.success)
      return

    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.datasetsById.people!.rows = [{ id: 'grace', label: 'Grace' }]
    const next = createProjectSnapshot(document, 2)
    coordinator.acceptSnapshot(next, {
      project: false,
      surfaceIds: [],
      datasetIds: ['people'],
      resourceIds: [],
      nodeChanges: [],
    })
    const nextHome = coordinator.compileSurface('home')
    const nextEditor = coordinator.compileSurface('editor')
    expect(nextHome.success && nextEditor.success).toBe(true)
    if (!nextHome.success || !nextEditor.success)
      return
    expect(nextHome.compilation.surface).not.toBe(home.compilation.surface)
    expect(nextEditor.compilation.surface).toBe(editor.compilation.surface)
  })

  it('keeps project compilation flat when interactions form a cyclic Surface graph', () => {
    const result = compileCanonicalProject(createCompilerFixture())
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.compilation.ir.surfacesById.editor?.interactions[0]).toMatchObject({
      action: { targetSurfaceId: 'details' },
    })
    expect(JSON.stringify(result.compilation.ir.surfacesById.editor)).not.toContain('details-action')
  })
})
