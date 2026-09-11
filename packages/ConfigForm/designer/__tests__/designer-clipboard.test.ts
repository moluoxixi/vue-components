// @vitest-environment happy-dom

import type { PageGraph, ProjectCommand } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { clearDesignerClipboard, useDesignerController } from '../src/composables/use-designer-controller'
import { extractDesignSubgraph, remapDesignSubgraph } from '../src/graph'
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

function field(id: string) {
  return {
    id,
    component: 'test.input',
    kind: 'field' as const,
    field: id,
    props: {},
    events: {},
    bindings: {},
  }
}

const graph: PageGraph = {
  version: 2,
  props: {},
  form: {},
  root: [
    { nodeId: 'lead', placement: { span: 12 } },
    { nodeId: 'section', placement: {} },
    { nodeId: 'tail', placement: {} },
  ],
  nodesById: {
    lead: field('lead'),
    section: {
      id: 'section',
      component: 'test.section',
      kind: 'layout',
      props: {},
      events: {},
      bindings: {},
      slots: { default: [{ nodeId: 'nested', placement: {} }] },
    },
    nested: field('nested'),
    tail: field('tail'),
  },
}

function controllerFixture() {
  clearDesignerClipboard()
  const execute = vi.fn((_command: ProjectCommand) => ({ changed: true, diagnostics: [] }))
  const controller = useDesignerController({
    execute,
    graph: () => graph,
    onDiagnostics: vi.fn(),
    onSelectionChange: vi.fn(),
    pageId: () => 'home',
    readonly: () => false,
    registry: () => registry,
  })
  return { controller, execute }
}

describe('design subgraph clipboard helpers', () => {
  it('extracts top-level nodes with subtrees and placements in document order', () => {
    const subgraph = extractDesignSubgraph(graph, ['section', 'lead'])!
    expect(subgraph.root.map(item => item.nodeId)).toEqual(['lead', 'section'])
    expect(subgraph.root[0]!.placement).toEqual({ span: 12 })
    expect(Object.keys(subgraph.nodesById).sort()).toEqual(['lead', 'nested', 'section'])
    // Selecting a nested child of a selected parent must not duplicate it.
    expect(extractDesignSubgraph(graph, ['missing'])).toBeUndefined()
  })

  it('remaps ids and clashing fields while keeping slot references in lockstep', () => {
    const subgraph = extractDesignSubgraph(graph, ['section'])!
    const remapped = remapDesignSubgraph(subgraph, graph)
    const rootId = remapped.root[0]!.nodeId
    expect(rootId).not.toBe('section')
    const layout = remapped.nodesById[rootId]!
    expect(layout.kind).toBe('layout')
    const childRef = layout.kind === 'layout' ? layout.slots.default![0]!.nodeId : ''
    expect(remapped.nodesById[childRef]).toBeDefined()
    const child = remapped.nodesById[childRef]!
    expect(child.kind === 'field' && child.field).toBe('nested_copy')
  })
})

describe('designer controller clipboard actions', () => {
  it('copies, cuts, and pastes through commands with fresh identities', () => {
    const { controller, execute } = controllerFixture()
    controller.select('lead')

    expect(controller.pasteAvailable.value).toBe(false)
    expect(controller.performNodeAction('copyToClipboard', 'lead')).toBe(true)
    expect(controller.pasteAvailable.value).toBe(true)
    // Copying alone must not dispatch any command.
    expect(execute).not.toHaveBeenCalled()

    expect(controller.performNodeAction('paste', 'tail')).toBe(true)
    const paste = execute.mock.calls[0]![0]
    expect(paste.label).toBe('Paste component')
    expect(paste.actions[0]).toMatchObject({
      operations: [{
        type: 'node.insert',
        target: { parentId: null, index: 3 },
      }],
    })
    const inserted = (paste.actions[0] as { operations: Array<{ subgraph: { nodesById: Record<string, { kind: string, field?: string }> } }> }).operations[0]!.subgraph
    expect(Object.values(inserted.nodesById)[0]!.field).toBe('lead_copy')

    expect(controller.performNodeAction('cut', 'lead')).toBe(true)
    const cut = execute.mock.calls[1]![0]
    expect(cut.actions[0]).toMatchObject({
      operations: [{ type: 'node.remove', nodeId: 'lead' }],
    })
    expect(controller.pasteAvailable.value).toBe(true)
  })

  it('pastes to the page root when nothing is selected', () => {
    const { controller, execute } = controllerFixture()
    controller.select('section')
    expect(controller.performNodeAction('copyToClipboard', 'section')).toBe(true)
    expect(controller.performNodeAction('paste', '')).toBe(true)
    expect(execute.mock.calls[0]![0].actions[0]).toMatchObject({
      operations: [{ type: 'node.insert', target: { parentId: null, index: 3 } }],
    })
  })
})
