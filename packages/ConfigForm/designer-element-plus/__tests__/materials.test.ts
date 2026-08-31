import type { DesignerMaterialDefinition } from '@moluoxixi/config-form-designer'
import type { PageGraph } from '@moluoxixi/config-form-model'
import { pageGraphSchema } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import {
  createElementPlusDesignerRegistry,
  ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY,
  ELEMENT_PLUS_DESIGNER_MATERIALS,
  ELEMENT_PLUS_DESIGNER_ZH_CN,
} from '../index'

const expectedKeys = [
  'element.input',
  'element.textarea',
  'element.input-number',
  'element.select',
  'element.radio',
  'element.checkbox',
  'element.switch',
  'element.date',
  'element.time',
  'element.section',
  'element.card',
  'element.tabs',
  'element.tab-pane',
  'element.collapse',
  'element.collapse-item',
  'element.flex',
  'element.grid',
]

function graphForRootMaterials(): PageGraph {
  const registry = createElementPlusDesignerRegistry()
  const graph: PageGraph = { version: 2, props: {}, form: {}, root: [], nodesById: {} }
  registry.listMaterials().forEach((material, index) => {
    const subgraph = registry.createSubgraph(material.key, {
      id: `matrix-${index}`,
      ...(material.kind === 'field' ? { field: `field_${index}` } : {}),
    })
    expect(subgraph.root).toHaveLength(1)
    expect(subgraph.nodesById[subgraph.root[0]!.nodeId]).toMatchObject({
      component: material.key,
      kind: material.kind,
    })
    expect(() => structuredClone(subgraph)).not.toThrow()
    if (material.allowedParents?.length)
      return
    graph.root.push(...subgraph.root)
    Object.assign(graph.nodesById, subgraph.nodesById)
  })
  return graph
}

describe('element plus designer materials', () => {
  it('registers every material and matching locale module', () => {
    const entries = ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.modules.list()
    expect(entries.map(entry => entry.name)).toEqual(expectedKeys.map(key => key.replace('element.', '')))
    expect(entries.every(entry => entry.source === `./materials/${entry.name}.ts`)).toBe(true)
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.map(material => material.key)).toEqual(expectedKeys)
    expect(Object.keys(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.locales)).toEqual(expectedKeys)
    expect(Object.keys(ELEMENT_PLUS_DESIGNER_ZH_CN.materials ?? {})).toEqual(expectedKeys)
  })

  it('creates a normalized JSON-safe subgraph for every material', () => {
    const graph = graphForRootMaterials()
    expect(() => pageGraphSchema.parse(graph)).not.toThrow()
    expect(Object.keys(graph.nodesById)).toHaveLength(expectedKeys.length)
  })

  it('creates structural tabs and collapse children inside their real parent slots', () => {
    const registry = createElementPlusDesignerRegistry()
    const tabs = registry.createSubgraph('element.tabs', { id: 'tabs' })
    const collapse = registry.createSubgraph('element.collapse', { id: 'collapse' })

    expect(tabs.nodesById.tabs).toMatchObject({
      kind: 'layout',
      component: 'element.tabs',
      slots: { default: [{ nodeId: 'tabs-pane-1', placement: {} }] },
    })
    expect(tabs.nodesById['tabs-pane-1']).toMatchObject({
      kind: 'layout',
      component: 'element.tab-pane',
    })
    expect(collapse.nodesById.collapse).toMatchObject({
      kind: 'layout',
      component: 'element.collapse',
      slots: { default: [{ nodeId: 'collapse-item-1', placement: {} }] },
    })
    expect(collapse.nodesById['collapse-item-1']).toMatchObject({
      kind: 'layout',
      component: 'element.collapse-item',
    })
  })

  it('publishes complete source, binding, event, and property-control metadata', () => {
    const registry = createElementPlusDesignerRegistry()
    expect(registry.listMaterials().every(material => !!material.source)).toBe(true)
    expect(registry.getMaterial('element.date')?.source?.tag).toBe('el-date-picker')
    expect(registry.getMaterial('element.checkbox')?.source?.options).toMatchObject({
      mode: 'children',
      optionTag: 'el-checkbox',
    })
    const inputRuntime = registry.getMaterial('element.input')?.runtime
    expect(inputRuntime?.valueProp ?? 'modelValue').toBe('modelValue')
    expect(inputRuntime?.trigger ?? `update:${inputRuntime?.valueProp ?? 'modelValue'}`).toBe('update:modelValue')
    expect(registry.getMaterial('element.tabs')?.events).toEqual([
      { name: 'tab-change', title: 'Active tab change' },
    ])
    expect(registry.getMaterial('element.collapse')?.events).toEqual([
      { name: 'change', title: 'Expanded items change' },
    ])
    expect(Object.keys(registry.propertyControls)).toEqual(['text', 'textarea', 'number', 'boolean', 'select'])
  })

  it('creates independent defaults for every field material', () => {
    const registry = createElementPlusDesignerRegistry()
    const fields = registry.listMaterials().filter(material => material.kind === 'field')
    for (const [index, material] of fields.entries()) {
      const first = registry.createSubgraph(material.key, { id: `first-${index}`, field: `first_${index}` })
      const second = registry.createSubgraph(material.key, { id: `second-${index}`, field: `second_${index}` })
      const firstNode = first.nodesById[`first-${index}`]!
      const secondNode = second.nodesById[`second-${index}`]!
      expect(firstNode).not.toBe(secondNode)
      expect(firstNode.props).not.toBe(secondNode.props)
      expect(material.setters.some(setter => setter.path.join('.') === 'defaultValue')).toBe(true)
      expect(typeof material.runtime.readonlyRender).toBe('function')
    }
  })

  it('keeps caller registry layers above provider defaults', () => {
    const override: DesignerMaterialDefinition = {
      key: 'element.input',
      version: 1,
      kind: 'field',
      title: 'Override input',
      category: 'Custom',
      runtime: { component: 'input' },
      setters: [],
      createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'element.input' }),
    }
    const registry = createElementPlusDesignerRegistry([{ name: 'override', materials: [override] }])

    expect(registry.getMaterial('element.input')?.title).toBe('Override input')
    expect(registry.createSubgraph('element.input', { id: 'custom', field: 'custom' }).nodesById.custom)
      .toMatchObject({ component: 'element.input', field: 'custom' })
  })
})
