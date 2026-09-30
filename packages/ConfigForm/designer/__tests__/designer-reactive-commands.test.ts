import type { ProjectDocument, PrototypeInteraction, SurfaceGraph } from '@moluoxixi/config-form-model'
import { createProjectDomainEngine, createProjectSnapshot, PROJECT_DOCUMENT_VERSION, PROJECT_THEME_VERSION, registryLockFingerprint, SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { isProxy, reactive, readonly, shallowReadonly, toRaw } from 'vue'
import { cloneDesignerJson, createFormCommand, createNodePathCommand, createSurfaceInteractionsCommand, extractDesignSubgraph, remapDesignSubgraph } from '../src/graph'

function createGraph(): SurfaceGraph {
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: { readonly: true },
    root: [{ nodeId: 'field', placement: { span: 6 } }],
    nodesById: {
      field: {
        id: 'field',
        kind: 'field',
        component: 'test.input',
        field: 'name',
        props: { appearance: { size: 'small', clearable: true } },
        defaultValue: 'draft',
      },
    },
  }
}

function createProject(graph: SurfaceGraph): ProjectDocument {
  const components = { 'test.input': { contractVersion: '1', fingerprint: 'fnv1a:11111111' } }
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'reactive-commands',
    name: 'Reactive commands',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: { id: 'home', kind: 'page', name: 'Home', route: '/', parameters: [], outputs: [], interactions: [], graph },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: { adapter: 'test', version: '1', fingerprint: registryLockFingerprint(components), components },
    settings: {},
  }
}

describe('designer reactive command boundaries', () => {
  it('detaches deep reactive graph props and separately nested proxy values', () => {
    const original = createGraph()
    const graph = reactive(original)
    const sourceBefore = structuredClone(original)
    const next = { entries: reactive([{ label: 'New' }]) }
    expect(() => structuredClone(graph.nodesById.field!.props)).toThrow()
    expect(() => structuredClone(toRaw(next))).toThrow()

    const command = createNodePathCommand(graph, 'home', ['field'], ['props', 'appearance', 'details'], next)
    expect(command.actions).toMatchObject([{
      operations: [{ props: { appearance: { size: 'small', clearable: true, details: { entries: [{ label: 'New' }] } } } }],
    }])
    expect(() => structuredClone(command)).not.toThrow()
    expect(original).toEqual(sourceBefore)

    next.entries[0]!.label = 'Changed after creation'
    graph.nodesById.field!.props.appearance = { size: 'large' }
    expect(command.actions).toMatchObject([{
      operations: [{ props: { appearance: { size: 'small', details: { entries: [{ label: 'New' }] } } } }],
    }])
  })

  it('keeps undefined as explicit removal and preserves null as a value', () => {
    const original = createGraph()
    const graph = reactive(original)
    const nested = createNodePathCommand(graph, 'home', ['field'], ['props', 'appearance', 'clearable'], undefined)
    expect(nested.actions).toMatchObject([{ operations: [{ props: { appearance: { size: 'small' } } }] }])
    expect(nested.actions[0]).not.toHaveProperty('operations.0.props.appearance.clearable')
    expect(createNodePathCommand(graph, 'home', ['field'], ['defaultValue'], undefined).actions)
      .toMatchObject([{ patch: { unset: ['defaultValue'] } }])
    expect(createNodePathCommand(graph, 'home', ['field'], ['defaultValue'], null).actions)
      .toMatchObject([{ patch: { set: { defaultValue: null } } }])
    expect(original).toEqual(createGraph())
  })

  it('clones reactive patch values and form changes without retaining caller state', () => {
    const graph = reactive(createGraph())
    const tags = reactive(['initial'])
    const value = readonly({ tags })
    const patch = createNodePathCommand(graph, 'home', ['field'], ['defaultValue'], value)
    expect(patch.actions).toMatchObject([{ patch: { set: { defaultValue: { tags: ['initial'] } } } }])
    expect(() => structuredClone(patch)).not.toThrow()
    tags.push('changed')
    expect(patch.actions[0]).toHaveProperty('patch.set.defaultValue.tags', ['initial'])

    const responsive = { tablet: reactive({ columns: 6 }) }
    const changes = reactive({ readonly: undefined, labelWidth: 120, responsive })
    const form = createFormCommand(graph, 'home', changes)
    expect(form.actions).toMatchObject([{ operations: [{ type: 'surface.form', form: { labelWidth: 120, responsive: { tablet: { columns: 6 } } } }] }])
    expect(form.actions[0]).not.toHaveProperty('operations.0.form.readonly')
    expect(graph.form).toEqual({ readonly: true })
    changes.labelWidth = 240
    responsive.tablet.columns = 12
    expect(form.actions).toMatchObject([{ operations: [{ form: { labelWidth: 120, responsive: { tablet: { columns: 6 } } } }] }])
  })

  it('reconciles reactive options, defaults and validation in a single detached command', () => {
    const original = createGraph()
    original.nodesById.field = {
      ...original.nodesById.field!,
      kind: 'field',
      field: 'name',
      defaultValue: 'draft',
      validation: { version: 2, base: { type: 'enum', values: ['draft', 'published'] }, rules: [], optional: true },
    }
    const graph = reactive(original)
    const sourceBefore = structuredClone(original)
    const options = reactive([{ label: 'Published', value: 'published' }])
    const command = createNodePathCommand(graph, 'home', ['field'], ['props', 'options'], options)
    expect(command.actions).toHaveLength(1)
    expect(command.actions[0]).toMatchObject({ operations: [
      { type: 'node.props', props: { options: [{ label: 'Published', value: 'published' }] } },
      { type: 'node.settings', settings: { validation: { version: 2, base: { type: 'enum', values: ['published'] }, rules: [], optional: true } } },
    ] })
    expect(command.actions[0]).not.toHaveProperty('operations.1.settings.defaultValue')
    expect(() => structuredClone(command)).not.toThrow()
    expect(original).toEqual(sourceBefore)
    options[0]!.value = 'changed'
    expect(command.actions[0]).toHaveProperty('operations.0.props.options.0.value', 'published')

    const engine = createProjectDomainEngine({ document: createProjectSnapshot(createProject(original)) })
    expect(engine.execute(command).changed).toBe(true)
    expect(engine.snapshot.editVersion).toBe(1)
    expect(engine.snapshot.history.position).toBe(1)
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.field).not.toHaveProperty('defaultValue')
    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.graph).toEqual(sourceBefore)
  })

  it('detaches interaction arrays whose actions contain nested proxies', () => {
    const action = reactive({ kind: 'navigate' as const, targetSurfaceId: 'detail', parameters: [] })
    const interactions: PrototypeInteraction[] = [{ kind: 'primaryUiAction', id: 'open', nodeId: 'field', trigger: 'activate', action }]
    const command = createSurfaceInteractionsCommand('home', shallowReadonly(interactions))
    expect(() => structuredClone(command)).not.toThrow()
    action.targetSurfaceId = 'changed'
    expect(command.actions).toMatchObject([{ operations: [{ interactions: [{ action: { targetSurfaceId: 'detail' } }] }] }])
  })

  it('uses the same detached JSON boundary for reactive clipboard graphs', () => {
    const graph = reactive(createGraph())
    const subgraph = extractDesignSubgraph(graph, ['field'])!
    const copy = remapDesignSubgraph(reactive(subgraph), graph)
    const copiedId = copy.root[0]!.nodeId
    expect(isProxy(subgraph.nodesById.field!.props)).toBe(false)
    expect(copy.nodesById[copiedId]!.props).toEqual(graph.nodesById.field!.props)
    copy.nodesById[copiedId]!.props.appearance = { size: 'large' }
    expect(subgraph.nodesById.field!.props).toEqual({ appearance: { size: 'small', clearable: true } })
    expect(graph).toEqual(createGraph())
  })

  it.each([
    ['function', { nested: () => true }],
    ['undefined', { nested: undefined }],
    ['non-finite number', { nested: Number.NaN }],
    ['date', { nested: new Date('2026-01-01') }],
    ['map', { nested: new Map([['key', 'value']]) }],
    ['symbol', { nested: Symbol('value') }],
    ['symbol key', { [Symbol('key')]: 'value' }],
    ['undefined array item', { nested: [undefined] }],
  ])('rejects %s values instead of silently changing them into JSON', (_name, value) => {
    expect(() => createNodePathCommand(reactive(createGraph()), 'home', ['field'], ['defaultValue'], value))
      .toThrow(/DESIGN_JSON_INVALID/)
  })

  it('rejects cycles through raw and reactive references while allowing shared children', () => {
    const source: Record<string, unknown> = {}
    const proxy = reactive(source)
    source.self = proxy
    expect(() => cloneDesignerJson(source)).toThrow(/DESIGN_JSON_INVALID/)

    const shared = reactive({ list: [false, 0, '', null] })
    const cloned = cloneDesignerJson({ left: shared, right: shared })
    expect(cloned).toEqual({ left: { list: [false, 0, '', null] }, right: { list: [false, 0, '', null] } })
    expect(isProxy(cloned.left)).toBe(false)
    cloned.left.list.push('clone')
    expect(shared.list).toEqual([false, 0, '', null])
    expect(cloned.right.list).toEqual([false, 0, '', null])
  })

  it('rejects sparse array entries instead of silently converting them into null', () => {
    const sparse: unknown[] = []
    sparse.length = 1
    expect(() => cloneDesignerJson(reactive(sparse))).toThrow(/DESIGN_JSON_INVALID/)
  })
})
