import type { LayoutNode, PageGraph, ProjectDocument } from '@moluoxixi/config-form-model'
import { createNodePathCommand, DEFAULT_DESIGNER_PROPERTY_CONTROLS, isDesignerSetterPathAllowed, useDesignerController } from '@moluoxixi/config-form-designer'
import { createComponentContractRegistry, createProjectDomainEngine, PROJECT_DOCUMENT_VERSION } from '@moluoxixi/config-form-model'
import { describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { createElementPlusDesignerRegistry, ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY } from '../index'

function fixture() {
  const registry = createElementPlusDesignerRegistry()
  const contracts = createComponentContractRegistry(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.contracts, { adapter: 'element', version: '1' })
  const graph = shallowRef<PageGraph>({ version: 3, props: {}, form: {}, root: [], nodesById: {} })
  const document: ProjectDocument = {
    version: PROJECT_DOCUMENT_VERSION,
    id: 'nested',
    name: 'Nested',
    homePageId: 'home',
    pageOrder: ['home'],
    pagesById: { home: { id: 'home', name: 'Home', route: '/', graph: graph.value } },
    registryLock: structuredClone(contracts.lock),
    settings: {},
    resources: {},
  }
  const engine = createProjectDomainEngine({ document, registry: contracts })
  const scope = effectScope()
  const controller = scope.run(() => useDesignerController({
    graph: () => graph.value,
    registry: () => registry,
    pageId: () => 'home',
    readonly: () => false,
    onDiagnostics: vi.fn(),
    onSelectionChange: vi.fn(),
    execute(command) {
      const result = engine.execute(JSON.parse(JSON.stringify(command)))
      graph.value = JSON.parse(JSON.stringify(engine.snapshot.document.pagesById.home!.graph)) as PageGraph
      return result
    },
  }))!
  const add = (name: string, parentId: string | null = null) => {
    expect(controller.addMaterial(`element.${name}`, parentId ? { parentId, slot: 'default' } : { parentId: null })).toBe(true)
    return controller.selectedId.value!
  }
  return { registry, graph, engine, scope, controller, add }
}

describe('element nested materials', () => {
  it('creates one default-slot template and allocates keys in the owning scope on create, copy and paste', () => {
    const { add, graph, controller, scope } = fixture()
    try {
      const first = add('object-group')
      const second = add('object-group')
      expect(graph.value.nodesById[first]).toMatchObject({ valueScope: { kind: 'object', field: 'object' }, slots: { default: [] } })
      expect(graph.value.nodesById[second]).toMatchObject({ valueScope: { field: 'object_2' } })
      const firstInput = add('input', first)
      const secondInput = add('input', second)
      expect(graph.value.nodesById[firstInput]).toMatchObject({ field: 'input' })
      expect(graph.value.nodesById[secondInput]).toMatchObject({ field: 'input' })
      const array = add('array-subform', first)
      const table = add('detail-table', array)
      expect(graph.value.nodesById[array]).toMatchObject({ valueScope: { kind: 'array', field: 'items', minItems: 0 }, props: { arrayDisplay: 'list' } })
      expect(graph.value.nodesById[table]).toMatchObject({ valueScope: { kind: 'array', field: 'details', minItems: 0 }, props: { arrayDisplay: 'table' }, slots: { default: [] } })
      controller.select(first)
      expect(controller.performNodeAction('copy', first)).toBe(true)
      const copy = controller.selectedNode.value as LayoutNode
      expect(copy.valueScope?.field).toBe('object_copy')
      expect(copy.slots.default!.map(item => graph.value.nodesById[item.nodeId])).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: 'input' }),
        expect.objectContaining({ valueScope: expect.objectContaining({ field: 'items' }) }),
      ]))
      controller.select(first)
      expect(controller.performNodeAction('copyToClipboard', first)).toBe(true)
      expect(controller.performNodeAction('paste', second)).toBe(true)
      expect((controller.selectedNode.value as LayoutNode).valueScope?.field).toBe('object_copy_2')
    }
    finally { scope.stop() }
  })

  it('exposes only allowed property setters and rejects value-scope authoring', () => {
    const { add, graph, controller, registry, scope } = fixture()
    try {
      const id = add('detail-table')
      const values: Record<string, unknown> = { title: 'Invoice lines', arrayDisplay: 'list', readonly: true, disabled: true }
      for (const setter of registry.getMaterial('element.detail-table')!.setters) {
        expect(isDesignerSetterPathAllowed(setter.path)).toBe(true)
        expect(
          registry.propertyControls[setter.control as 'text']
          ?? DEFAULT_DESIGNER_PROPERTY_CONTROLS[setter.control as 'text'],
        ).toBeDefined()
        expect(controller.dispatch(createNodePathCommand(graph.value, 'home', [id], setter.path, values[setter.key]))).toBe(true)
      }
      expect(graph.value.nodesById[id]).toMatchObject({ valueScope: { kind: 'array', field: 'details', minItems: 0 }, props: { arrayDisplay: 'list', readonly: true, disabled: true } })
      const before = structuredClone(graph.value.nodesById[id])
      expect(() => createNodePathCommand(graph.value, 'home', [id], ['valueScope', 'field'], 'order.details'))
        .toThrow(/DESIGNER_SETTER_PATH_FORBIDDEN/)
      expect(() => createNodePathCommand(graph.value, 'home', [id], ['valueScope', 'maxItems'], 5))
        .toThrow(/DESIGNER_SETTER_PATH_FORBIDDEN/)
      expect(graph.value.nodesById[id]).toEqual(before)
    }
    finally { scope.stop() }
  })
})
