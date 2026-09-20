import type {
  ProjectCommand,
  ProjectDocument,
  ProjectHistorySummary,
  SurfaceGraph,
} from '@moluoxixi/config-form-model'
import {
  createProjectDomainEngine,
  createProjectSnapshot,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_THEME_VERSION,
  registryLockFingerprint,
} from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useDesignSurfaceCommands } from '../src/components/DesignSurface/composables'
import { useDesignerController } from '../src/composables/use-designer-controller'
import { createNodePathCommand } from '../src/graph'
import { createDesignerRegistry } from '../src/registry'

const registry = createDesignerRegistry({ materials: [
  {
    key: 'test.input',
    version: 1,
    kind: 'field',
    category: 'Fields',
    title: 'Input',
    runtime: { component: 'input' },
    setters: [],
    createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'test.input' }),
  },
  {
    key: 'test.section',
    version: 1,
    kind: 'layout',
    category: 'Layout',
    title: 'Section',
    runtime: { component: 'section' },
    setters: [],
    slots: [{ name: 'default', title: 'Content', accepts: ['field', 'layout'] }],
    createNode: ({ id }) => ({ id, kind: 'layout', component: 'test.section', slots: { default: [] } }),
  },
] })

const graph: SurfaceGraph = {
  version: 2,
  props: {},
  form: {},
  root: [
    { nodeId: 'lead', placement: {} },
    { nodeId: 'section', placement: {} },
    { nodeId: 'sibling', placement: {} },
    { nodeId: 'tail', placement: {} },
  ],
  nodesById: {
    lead: field('lead'),
    section: {
      id: 'section',
      component: 'test.section',
      kind: 'layout',
      props: {},
      datasetBindings: {},
      slots: { default: [{ nodeId: 'nested', placement: {} }] },
    },
    nested: field('nested'),
    sibling: field('sibling'),
    tail: field('tail'),
  },
}

function field(id: string) {
  return {
    id,
    component: 'test.input',
    kind: 'field' as const,
    field: id,
    props: {},
    datasetBindings: {},
  }
}

function projectDocument(surfaceGraph: SurfaceGraph): ProjectDocument {
  const components = {
    'test.input': { contractVersion: '1', fingerprint: 'fnv1a:11111111' },
    'test.section': { contractVersion: '1', fingerprint: 'fnv1a:22222222' },
  }
  return {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'designer-test',
    name: 'Designer Test',
    homeSurfaceId: 'home',
    surfaceOrder: ['home'],
    surfacesById: {
      home: {
        id: 'home',
        kind: 'page',
        name: 'Home',
        route: '/',
        parameters: [],
        outputs: [],
        interactions: [],
        graph: surfaceGraph,
      },
    },
    datasetOrder: [],
    datasetsById: {},
    resources: {},
    theme: { version: PROJECT_THEME_VERSION },
    registryLock: {
      adapter: 'test',
      version: '1',
      fingerprint: registryLockFingerprint(components),
      components,
    },
    settings: {},
  }
}

function mutableFixture() {
  const current = ref(graph)
  const controller = useDesignerController({
    execute: vi.fn(() => ({ changed: true, diagnostics: [] })),
    graph: () => current.value,
    onDiagnostics: vi.fn(),
    onSelectionChange: vi.fn(),
    surfaceId: () => 'home',
    readonly: () => false,
    registry: () => registry,
  })
  const publish = (nodeId?: string) => {
    current.value = nodeId
      ? {
          ...graph,
          root: [...graph.root, { nodeId, placement: {} }],
          nodesById: { ...graph.nodesById, [nodeId]: field(nodeId) },
        }
      : { ...graph }
  }
  return { controller, publish }
}

function controllerFixture() {
  const execute = vi.fn((_command: ProjectCommand) => ({ changed: true, diagnostics: [] }))
  const controller = useDesignerController({
    execute,
    graph: () => graph,
    onDiagnostics: vi.fn(),
    onSelectionChange: vi.fn(),
    surfaceId: () => 'home',
    readonly: () => false,
    registry: () => registry,
  })
  return { controller, execute }
}

describe('designer controller batch actions', () => {
  it('uses document-order ranges and removes only top-level selected nodes in one command', () => {
    const { controller, execute } = controllerFixture()
    controller.select('section')
    controller.select('sibling', 'range')

    expect(controller.selectedIds.value).toEqual(['section', 'nested', 'sibling'])
    expect(controller.performNodeAction('remove', 'sibling')).toBe(true)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![0]).toMatchObject({
      label: 'Remove components',
      actions: [{
        operations: [
          { type: 'node.remove', nodeId: 'section' },
          { type: 'node.remove', nodeId: 'sibling' },
        ],
      }],
    })
  })

  it('builds one command for a multi-node move and one for a multi-node span edit', () => {
    const { controller, execute } = controllerFixture()
    controller.select('lead')
    controller.select('section', 'toggle')

    expect(controller.performNodeAction('moveAfter', 'section')).toBe(true)
    const move = execute.mock.calls[0]![0]
    expect(move.label).toBe('Move components')
    expect(move.actions).toHaveLength(1)
    expect(move.actions[0]).toMatchObject({
      operations: [
        { type: 'node.move', nodeId: 'section' },
        { type: 'node.move', nodeId: 'lead' },
      ],
    })

    const resize = createNodePathCommand(graph, 'home', ['lead', 'sibling'], ['span'], 6)
    expect(resize.label).toBe('Resize components')
    expect(resize.actions).toEqual([
      { type: 'node.resize', surfaceId: 'home', nodeId: 'lead', span: 6 },
      { type: 'node.resize', surfaceId: 'home', nodeId: 'sibling', span: 6 },
    ])
  })

  it.each([
    ['events', 'click'],
    ['bindings', 'value'],
    ['conditions', 'disabled'],
    ['reactions'],
    ['extensions', 'advanced'],
    ['valueScope', 'field'],
    ['props', 'optionSource'],
  ])('rejects commands that write %s outside the default Designer boundary', (...path) => {
    expect(() => createNodePathCommand(graph, 'home', ['lead'], path, true))
      .toThrow(/DESIGNER_SETTER_PATH_FORBIDDEN/)
  })

  it('clears an invalid option default atomically and exposes one guarded undo notice', async () => {
    const optionsGraph: SurfaceGraph = {
      ...graph,
      nodesById: {
        ...graph.nodesById,
        lead: {
          ...field('lead'),
          defaultValue: 'draft',
          validation: {
            version: 2,
            base: { type: 'enum', values: ['draft', 'published'] },
            rules: [],
          },
          props: {
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Published', value: 'published' },
            ],
          },
        },
      },
    }
    let acceptedCommandId: string | undefined
    let history: ProjectHistorySummary = { entries: [], limit: 100, position: 0 }
    const execute = vi.fn((command: ProjectCommand) => {
      acceptedCommandId = command.id
      history = {
        entries: [{ id: command.id, label: command.label, editVersion: 1, timestamp: 1 }],
        limit: 100,
        position: 1,
      }
      return { changed: true, diagnostics: [] }
    })
    const controller = useDesignerController({
      execute,
      graph: () => optionsGraph,
      onDiagnostics: vi.fn(),
      onSelectionChange: vi.fn(),
      surfaceId: () => 'home',
      readonly: () => false,
      registry: () => registry,
    })
    const undo = vi.fn(() => true)
    const onNotice = vi.fn()
    const commands = useDesignSurfaceCommands({
      activeBreakpoint: ref('desktop'),
      activeWorkspaceView: ref('canvas'),
      closeMediumPanel: vi.fn(),
      controller,
      deletedNotice: () => 'Deleted',
      historyControl: () => ({ canRedo: false, canUndo: true, history, redo: () => false, undo }),
      lastAcceptedCommandId: () => acceptedCommandId,
      mediumPanel: ref(),
      onNotice,
      optionDefaultsClearedNotice: count => `${count} default cleared`,
      surfaceId: () => 'home',
      readonly: () => false,
      rootRef: ref(),
      selectBreakpoint: vi.fn(),
      workspaceMode: computed(() => 'desktop' as const),
    })

    commands.handleUpdatePath('lead', ['props', 'options'], [
      { label: 'Published', value: 'published' },
    ])
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.calls[0]![0].actions).toEqual([{
      type: 'operation.apply',
      operations: [
        {
          type: 'node.props',
          surfaceId: 'home',
          nodeId: 'lead',
          props: { options: [{ label: 'Published', value: 'published' }] },
        },
        {
          type: 'node.settings',
          surfaceId: 'home',
          nodeId: 'lead',
          settings: {
            component: 'test.input',
            datasetBindings: {},
            field: 'lead',
            kind: 'field',
            validation: {
              version: 2,
              base: { type: 'enum', values: ['published'] },
              rules: [],
            },
          },
        },
      ],
    }])

    await nextTick()
    expect(onNotice).toHaveBeenCalledOnce()
    expect(onNotice.mock.calls[0]?.[0]).toBe('1 default cleared')
    const undoNotice = onNotice.mock.calls[0]?.[1] as () => boolean
    expect(undoNotice()).toBe(true)
    expect(undo).toHaveBeenCalledOnce()
  })

  it('commits option, default, and enum validation changes as one undoable history entry', () => {
    const originalGraph: SurfaceGraph = {
      ...graph,
      nodesById: {
        ...graph.nodesById,
        lead: {
          ...field('lead'),
          defaultValue: 'draft',
          validation: {
            version: 2,
            base: { type: 'enum', values: ['draft', 'published'] },
            rules: [],
          },
          props: { options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
        },
      },
    }
    const originalNode = structuredClone(originalGraph.nodesById.lead)
    const engine = createProjectDomainEngine({ document: createProjectSnapshot(projectDocument(originalGraph)) })
    const command = createNodePathCommand(originalGraph, 'home', ['lead'], ['props', 'options'], [
      { label: 'Published', value: 'published' },
    ])

    expect(engine.execute(command).changed).toBe(true)
    expect(engine.snapshot.history).toMatchObject({ position: 1 })
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.lead).toMatchObject({
      props: { options: [{ label: 'Published', value: 'published' }] },
      validation: { base: { type: 'enum', values: ['published'] } },
    })
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.lead).not.toHaveProperty('defaultValue')

    expect(engine.undo().changed).toBe(true)
    expect(engine.snapshot.document.surfacesById.home!.graph.nodesById.lead).toEqual(originalNode)
  })

  it('recomputes literal option validation and clears it when new options are not representable', () => {
    const literalGraph: SurfaceGraph = {
      ...graph,
      nodesById: {
        ...graph.nodesById,
        lead: {
          ...field('lead'),
          validation: { version: 2, base: { type: 'literal', value: 1 }, rules: [] },
          props: { options: [{ label: 'One', value: 1 }] },
        },
      },
    }
    const recomputed = createNodePathCommand(literalGraph, 'home', ['lead'], ['props', 'options'], [
      { label: 'Enabled', value: true },
    ])
    expect(recomputed.actions[0]).toMatchObject({
      operations: [{ type: 'node.props' }, {
        type: 'node.settings',
        settings: { validation: { base: { type: 'literal', value: true } } },
      }],
    })

    const cleared = createNodePathCommand(literalGraph, 'home', ['lead'], ['props', 'options'], [
      { label: 'One', value: 1 },
      { label: 'Two', value: 2 },
    ])
    const settings = (cleared.actions[0] as Extract<ProjectCommand['actions'][number], { type: 'operation.apply' }>)
      .operations[1]
    expect(settings).toMatchObject({ type: 'node.settings' })
    expect(settings).not.toHaveProperty('settings.validation')
  })
})

describe('designer controller deferred selection', () => {
  it('selects a node the graph publishes one propagation after the request', async () => {
    const { controller, publish } = mutableFixture()

    // Dropping a material dispatches the insert and selects the new node before
    // the parent graph prop carries it.
    controller.select('fresh')
    expect(controller.selectedIds.value).toEqual([])

    publish('fresh')
    await nextTick()
    expect(controller.selectedIds.value).toEqual(['fresh'])
    expect(controller.selectedId.value).toBe('fresh')
  })

  it('drops the deferred selection when the next graph still lacks the node', async () => {
    const { controller, publish } = mutableFixture()
    controller.select('ghost')

    publish()
    await nextTick()
    expect(controller.selectedIds.value).toEqual([])

    // A later arrival must not resurrect a stale request.
    publish('ghost')
    await nextTick()
    expect(controller.selectedIds.value).toEqual([])
  })

  it('keeps additive selection modes out of the deferred path', async () => {
    const { controller, publish } = mutableFixture()
    controller.select('lead')
    controller.select('unknown', 'toggle')

    publish('unknown')
    await nextTick()
    expect(controller.selectedIds.value).toEqual([])
  })
})
