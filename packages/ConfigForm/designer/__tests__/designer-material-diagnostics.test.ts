import type { SurfaceGraph } from '@moluoxixi/config-form-model'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useDesignerController } from '../src/composables/use-designer-controller'
import { designerDiagnostic } from '../src/graph'
import { createDesignerRegistry } from '../src/registry'

describe('designer material diagnostics', () => {
  it('publishes custom field, layout and element analysis and updates it with the graph', async () => {
    const registry = createDesignerRegistry({ materials: [
      {
        key: 'test.input',
        version: 1,
        kind: 'field',
        title: 'Input',
        category: 'Fields',
        runtime: { component: 'input' },
        setters: [],
        createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'test.input' }),
        analyze: (node, path) => node.label ? [] : [designerDiagnostic('TEST_FIELD_LABEL', 'A label is missing.', path, 'warning', node.id)],
      },
      {
        key: 'test.section',
        version: 1,
        kind: 'layout',
        title: 'Section',
        category: 'Layout',
        runtime: { component: 'section' },
        setters: [],
        slots: [{ name: 'default', title: 'Content' }],
        createNode: ({ id }) => ({ id, kind: 'layout', component: 'test.section', slots: { default: [] } }),
        analyze: (node, path) => [designerDiagnostic('TEST_LAYOUT', 'Layout diagnostic.', path, 'warning', node.id)],
      },
      {
        key: 'test.text',
        version: 1,
        kind: 'element',
        title: 'Text',
        category: 'Elements',
        runtime: { component: 'span' },
        setters: [],
        createNode: ({ id }) => ({ id, kind: 'element', component: 'test.text' }),
        analyze: (node, path) => [designerDiagnostic('TEST_ELEMENT', 'Element diagnostic.', path, 'warning', node.id)],
      },
    ] })
    const graph = shallowRef<SurfaceGraph>({
      version: SURFACE_GRAPH_VERSION,
      props: {},
      form: {},
      root: ['name', 'section', 'text'].map(nodeId => ({ nodeId, placement: {} })),
      nodesById: {
        name: { id: 'name', kind: 'field', field: 'name', component: 'test.input', props: {} },
        section: { id: 'section', kind: 'layout', component: 'test.section', props: {}, slots: { default: [] } },
        text: { id: 'text', kind: 'element', component: 'test.text', props: {} },
      },
    })
    const onDiagnostics = vi.fn()
    const scope = effectScope()
    try {
      const controller = scope.run(() => useDesignerController({
        execute: () => ({ changed: false, diagnostics: [] }),
        graph: () => graph.value,
        surfaceId: () => 'home',
        registry: () => registry,
        readonly: () => false,
        onDiagnostics,
        onSelectionChange: vi.fn(),
      }))!
      expect(controller.diagnostics.value.map(item => item.code)).toEqual(['TEST_FIELD_LABEL', 'TEST_LAYOUT', 'TEST_ELEMENT'])
      expect(onDiagnostics).toHaveBeenLastCalledWith(controller.diagnostics.value)
      const next = structuredClone(graph.value)
      const field = next.nodesById.name!
      if (field.kind === 'field')
        field.label = 'Name'
      graph.value = next
      await nextTick()
      expect(controller.diagnostics.value.map(item => item.code)).toEqual(['TEST_LAYOUT', 'TEST_ELEMENT'])
      expect(onDiagnostics).toHaveBeenLastCalledWith(controller.diagnostics.value)
    }
    finally {
      scope.stop()
    }
  })
})
