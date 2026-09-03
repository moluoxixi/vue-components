import type { PageGraph, ProjectCommand } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
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

const graph: PageGraph = {
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
      events: {},
      bindings: {},
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
    events: {},
    bindings: {},
  }
}

function controllerFixture() {
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
      { type: 'node.resize', pageId: 'home', nodeId: 'lead', span: 6 },
      { type: 'node.resize', pageId: 'home', nodeId: 'sibling', span: 6 },
    ])
  })
})
