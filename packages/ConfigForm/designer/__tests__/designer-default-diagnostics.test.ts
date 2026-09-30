import type { FieldNode, ModelJsonValue, ProjectDataset, SurfaceGraph } from '@moluoxixi/config-form-model'
import type { DesignerPropertySetterDefinition } from '../src/registry'
import { SURFACE_GRAPH_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, shallowRef } from 'vue'
import { useDesignerController } from '../src/composables/use-designer-controller'
import { analyzeDesignGraph, createDesignerRegistry, resolveDesignerSetterOptions } from '../src/registry'

function createRegistry(setter: Partial<DesignerPropertySetterDefinition> = {}) {
  return createDesignerRegistry({ materials: [{
    key: 'test.custom',
    version: 1,
    kind: 'field',
    title: 'Custom',
    category: 'Fields',
    runtime: { component: 'input' },
    setters: [{ key: 'initial', label: 'Default', path: ['defaultValue'], control: 'defaultValue', valueKind: 'number', ...setter }],
    createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'test.custom' }),
  }] })
}

function createGraph(defaultValue: ModelJsonValue | undefined, extra: Partial<FieldNode> = {}): SurfaceGraph {
  return {
    version: SURFACE_GRAPH_VERSION,
    props: {},
    form: {},
    root: [{ nodeId: 'custom', placement: {} }],
    nodesById: { custom: {
      id: 'custom',
      kind: 'field',
      field: 'custom',
      component: 'test.custom',
      props: {},
      ...(defaultValue === undefined ? {} : { defaultValue }),
      ...structuredClone(extra),
    } },
  }
}

const optionsSetter = { valueKind: 'select', optionsPath: ['props', 'choices'] } satisfies Partial<DesignerPropertySetterDefinition>
const dataset: ProjectDataset = { id: 'choices', name: 'Choices', rows: [
  { meta: { id: 1 }, name: 'One' },
  { meta: { id: 2 }, name: 'Two' },
] }
const datasetField: Partial<FieldNode> = {
  props: { choices: [{ label: 'Stale static option', value: 'stale' }] },
  datasetBindings: { choices: { datasetId: 'choices', projection: { kind: 'options', valuePath: ['meta', 'id'], labelPath: ['name'] } } },
}

describe('setter-owned default diagnostics', () => {
  it.each([
    [{ valueKind: 'text' }, 1, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'boolean' }, 'true', 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'date' }, 1, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'time' }, 1, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'number' }, '1', 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'number' }, Infinity, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'number' }, Number.NaN, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'number', integer: true }, 1.5, 'DESIGNER_DEFAULT_INTEGER_REQUIRED'],
    [{ valueKind: 'number', min: 2 }, 1, 'DESIGNER_DEFAULT_MIN_UNMET'],
    [{ valueKind: 'number', max: 2 }, 3, 'DESIGNER_DEFAULT_MAX_EXCEEDED'],
    [{ valueKind: 'select' }, Infinity, 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'select', optionValueTypes: ['string'] }, 1, 'DESIGNER_DEFAULT_OPTION_TYPE_INVALID'],
    [{ valueKind: 'multiselect', optionValueTypes: ['number'] }, ['1'], 'DESIGNER_DEFAULT_OPTION_TYPE_INVALID'],
    [{ valueKind: 'multiselect' }, [Infinity], 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'multiselect' }, [true], 'DESIGNER_DEFAULT_KIND_INVALID'],
    [{ valueKind: 'select', options: [{ label: 'One', value: 1 }] }, '1', 'DESIGNER_DEFAULT_OPTION_UNKNOWN'],
    [{ valueKind: 'select', options: [{ label: 'One', value: 1 }] }, 2, 'DESIGNER_DEFAULT_OPTION_UNKNOWN'],
  ] satisfies Array<[Partial<DesignerPropertySetterDefinition>, ModelJsonValue, string]>)(
    'reports constrained default %# without requiring a RuleSet',
    (setter, value, code) => {
      const diagnostics = analyzeDesignGraph(createGraph(value), createRegistry(setter))
      expect(diagnostics).toHaveLength(1)
      expect(diagnostics[0]).toMatchObject({ code, nodeId: 'custom', severity: 'error' })
      expect(diagnostics[0]?.path.at(-1)).toBe('defaultValue')
    },
  )

  it.each([undefined, null, 2])('accepts an empty default or a number at both inclusive limits: %s', (value) => {
    expect(analyzeDesignGraph(createGraph(value), createRegistry({ integer: true, min: 2, max: 2 }))).toEqual([])
  })

  it('respects actual defaultValue paths, static option values and allowed types', () => {
    const registry = createRegistry({ valueKind: 'multiselect', optionsPath: ['props', 'options'], optionValueTypes: ['string', 'number'] })
    const graph = createGraph(['one', 2], { props: { options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 2 }] } })
    expect(analyzeDesignGraph(graph, registry)).toEqual([])
    expect(analyzeDesignGraph(createGraph(2), createRegistry({ path: ['props', 'elsewhere'], min: 5 }))).toEqual([])
    expect(analyzeDesignGraph(createGraph(true), createRegistry({ valueKind: 'select', options: [{ label: 'Yes', value: true }] }))).toEqual([])
  })

  it('uses projected Dataset options including nested paths and query paging instead of stale static props', () => {
    const registry = createRegistry(optionsSetter)
    const graph = reactive(createGraph(2, datasetField))
    expect(analyzeDesignGraph(graph, registry, { datasets: [dataset] })).toEqual([])
    const node = graph.nodesById.custom!
    const setter = registry.getMaterial('test.custom')!.setters[0]!
    expect(resolveDesignerSetterOptions(node, setter, [dataset])).toEqual([{ label: 'One', value: 1 }, { label: 'Two', value: 2 }])
    node.datasetBindings!.choices!.query = { page: { index: 1, size: 1 } }
    expect(analyzeDesignGraph(graph, registry, { datasets: [dataset] })).toEqual([])
    expect(resolveDesignerSetterOptions(node, setter, [dataset])).toEqual([{ label: 'Two', value: 2 }])
    if (node.kind === 'field')
      node.defaultValue = 1
    expect(analyzeDesignGraph(graph, registry, { datasets: [dataset] }).map(item => item.code)).toEqual(['DESIGNER_DEFAULT_OPTION_UNKNOWN'])
  })

  it('does not invent option mismatches while Dataset context is unavailable or its projection is invalid', () => {
    const registry = createRegistry(optionsSetter)
    const graph = createGraph(2, datasetField)
    expect(analyzeDesignGraph(graph, registry)).toEqual([])
    expect(analyzeDesignGraph(graph, registry, { datasets: [{ ...dataset, rows: [{ name: 'No value' }] }] })).toEqual([])
    expect(analyzeDesignGraph(graph, registry, { datasets: [{ ...dataset, rows: [] }] }).map(item => item.code)).toEqual(['DESIGNER_DEFAULT_OPTION_UNKNOWN'])
  })

  it('publishes external graph and Dataset changes while keeping command rejections visible', async () => {
    const registry = createRegistry(optionsSetter)
    const graph = shallowRef(createGraph(2, datasetField))
    const datasets = shallowRef([dataset])
    const onDiagnostics = vi.fn()
    const execute = vi.fn(() => ({ changed: false, diagnostics: [{ code: 'surface_graph_invalid' as const, message: 'Command was rejected.' }] }))
    const scope = effectScope()
    try {
      const controller = scope.run(() => useDesignerController({
        execute,
        graph: () => graph.value,
        datasets: () => datasets.value,
        registry: () => registry,
        surfaceId: () => 'home',
        readonly: () => false,
        onDiagnostics,
        onSelectionChange: vi.fn(),
      }))!
      expect(controller.diagnostics.value).toEqual([])
      datasets.value = [{ ...dataset, rows: dataset.rows.slice(0, 1) }]
      await nextTick()
      expect(controller.diagnostics.value.map(item => item.code)).toEqual(['DESIGNER_DEFAULT_OPTION_UNKNOWN'])
      expect(controller.dispatch({ id: 'rejected', label: 'Rejected edit', actions: [] })).toBe(false)
      await nextTick()
      expect(controller.diagnostics.value.map(item => item.code)).toEqual(['surface_graph_invalid', 'DESIGNER_DEFAULT_OPTION_UNKNOWN'])
      expect(onDiagnostics).toHaveBeenLastCalledWith(controller.diagnostics.value)
      graph.value = createGraph(1, datasetField)
      await nextTick()
      expect(controller.diagnostics.value.map(item => item.code)).toEqual(['surface_graph_invalid'])
      execute.mockReturnValue({ changed: true, diagnostics: [] })
      expect(controller.dispatch({ id: 'accepted', label: 'Accepted edit', actions: [] })).toBe(true)
      await nextTick()
      expect(onDiagnostics).toHaveBeenLastCalledWith([])
    }
    finally {
      scope.stop()
    }
  })
})
