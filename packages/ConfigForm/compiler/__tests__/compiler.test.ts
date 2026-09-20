import type { ProjectDocument } from '@moluoxixi/config-form-model'
import {
  createProjectDraftSnapshot,
  createProjectSnapshot,
} from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_PROJECT_IR_VERSION,
  compileCanonicalProject,
  compileCanonicalSurface,
  CONFIG_FORM_COMPILER_VERSION,
  createCompileCoordinator,
} from '../index'
import { createCompilerFixture } from './fixtures'

describe('surface canonical compiler', () => {
  it('compiles a flat project with page, dialog, drawer, element nodes, and references', () => {
    const input = createCompilerFixture()
    const result = compileCanonicalProject(input)

    expect(result.success).toBe(true)
    if (!result.success)
      return
    const { compilation } = result
    expect(compilation.ir.version).toBe(CANONICAL_PROJECT_IR_VERSION)
    expect(compilation.key.compilerVersion).toBe(CONFIG_FORM_COMPILER_VERSION)
    expect(compilation.ir.homeSurfaceId).toBe('home')
    expect(compilation.ir.surfaceOrder).toEqual(['home', 'editor', 'details'])
    expect(Object.keys(compilation.ir.surfacesById)).toEqual(['home', 'editor', 'details'])
    expect(compilation.ir.surfacesById.home?.kind).toBe('page')
    expect(compilation.ir.surfacesById.editor?.kind).toBe('dialog')
    expect(compilation.ir.surfacesById.details?.kind).toBe('drawer')
    expect(compilation.ir.surfacesById.home?.nodesById['open-editor']?.kind).toBe('element')
    expect(compilation.ir.surfacesById.home?.nodesById.name?.datasetBindings).toBeDefined()
    expect(compilation.ir.surfacesById.home?.nodesById.name).toMatchObject({
      required: true,
      requiredMessage: 'Name is required',
      validation: { version: 2 },
    })
    expect(compilation.ir.surfacesById.editor?.interactions[0]).toMatchObject({
      action: { targetSurfaceId: 'details' },
    })
    expect(compilation.ir.surfacesById.details?.interactions[0]).toMatchObject({
      action: { targetSurfaceId: 'editor' },
    })
    expect(Object.isFrozen(compilation)).toBe(true)
    expect(Object.isFrozen(compilation.ir)).toBe(true)
    expect(CANONICAL_PROJECT_IR_VERSION).toBe(7)
    expect(CONFIG_FORM_COMPILER_VERSION).toBe('8.0.0')
  })

  it('compiles one Surface without recursively inlining cyclic open targets', () => {
    const input = createCompilerFixture()
    const result = compileCanonicalSurface({ ...input, surfaceId: 'editor' })

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.compilation.surface.id).toBe('editor')
    expect(Object.keys(result.compilation.surface.nodesById)).toEqual(['editor-action'])
    expect(JSON.stringify(result.compilation)).not.toContain('details-action')
  })

  it('rejects unknown Surface identity and old graph fields at the compiler boundary', () => {
    const input = createCompilerFixture()
    expect(compileCanonicalSurface({ ...input, surfaceId: 'missing' })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'COMPILER_SURFACE_UNKNOWN', surfaceId: 'missing' }],
    })

    const stale = structuredClone(input.snapshot) as unknown as { document: Record<string, unknown> }
    const document = stale.document as { surfacesById: Record<string, { graph: Record<string, unknown> }> }
    document.surfacesById.home!.graph.bindings = {}
    expect(compileCanonicalProject({ ...input, snapshot: stale }).success).toBe(false)
  })

  it('keeps semantic project identity independent of edit chronology', () => {
    const first = compileCanonicalProject(createCompilerFixture(1))
    const second = compileCanonicalProject(createCompilerFixture(99))
    expect(first.success && second.success).toBe(true)
    if (!first.success || !second.success)
      return
    expect(first.compilation.key).toEqual(second.compilation.key)
    expect(first.compilation.ir).toEqual(second.compilation.ir)
    expect(first.compilation.origin).toEqual({ kind: 'committed', editVersion: 1 })
    expect(second.compilation.origin).toEqual({ kind: 'committed', editVersion: 99 })
  })

  it('compiles a draft without changing committed identity', () => {
    const input = createCompilerFixture()
    const document = structuredClone(input.snapshot.document) as ProjectDocument
    document.surfacesById.home!.graph.props.title = 'Draft title'
    const draft = createProjectDraftSnapshot(input.snapshot, document, 'candidate')
    const result = compileCanonicalProject({ ...input, snapshot: draft })
    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.compilation.origin).toEqual({
      kind: 'draft',
      baseEditVersion: input.snapshot.editVersion,
      draftId: 'candidate',
    })
    expect(result.compilation.key.contentHash).toBe(draft.draftHash)
  })

  it('invalidates only the changed Surface and dependent asset references', () => {
    const input = createCompilerFixture()
    const coordinator = createCompileCoordinator({ registry: input.registry, maxCachedSurfaces: 8 })
    coordinator.acceptSnapshot(input.snapshot)
    const home = coordinator.compileSurface('home')
    const details = coordinator.compileSurface('details')
    expect(home.success && details.success).toBe(true)
    if (!home.success || !details.success)
      return

    const changedDocument = structuredClone(input.snapshot.document) as ProjectDocument
    changedDocument.surfacesById.editor!.graph.props.title = 'Changed editor'
    const changed = createProjectSnapshot(changedDocument, 2)
    coordinator.acceptSnapshot(changed, {
      project: false,
      surfaceIds: ['editor'],
      datasetIds: [],
      resourceIds: [],
      nodeChanges: [],
    })
    const nextHome = coordinator.compileSurface('home')
    const nextDetails = coordinator.compileSurface('details')
    expect(nextHome.success && nextDetails.success).toBe(true)
    if (!nextHome.success || !nextDetails.success)
      return
    expect(nextHome.compilation.surface).toBe(home.compilation.surface)
    expect(nextDetails.compilation.surface).toBe(details.compilation.surface)
  })

  it('uses Dataset change attribution to invalidate referencing Surfaces', () => {
    const input = createCompilerFixture()
    const coordinator = createCompileCoordinator({ registry: input.registry, maxCachedSurfaces: 8 })
    coordinator.acceptSnapshot(input.snapshot)
    const home = coordinator.compileSurface('home')
    const editor = coordinator.compileSurface('editor')
    expect(home.success && editor.success).toBe(true)
    if (!home.success || !editor.success)
      return

    const changedDocument = structuredClone(input.snapshot.document) as ProjectDocument
    changedDocument.datasetsById.people!.rows = [{ id: 'grace', label: 'Grace' }]
    const changed = createProjectSnapshot(changedDocument, 2)
    coordinator.acceptSnapshot(changed, {
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
})
