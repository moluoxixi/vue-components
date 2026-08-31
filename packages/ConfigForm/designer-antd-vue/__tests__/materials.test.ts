import type { DesignerMaterialDefinition } from '@moluoxixi/config-form-designer'
import type { FieldNode, PageGraph } from '@moluoxixi/config-form-model'
import { pageGraphSchema } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import {
  ANTD_VUE_DESIGNER_MATERIAL_REGISTRY,
  ANTD_VUE_DESIGNER_MATERIALS,
  ANTD_VUE_DESIGNER_ZH_CN,
  ANTD_VUE_OPTION_RESOLVER_KEY,
  createAntdVueDesignerRegistry,
  createAntdVueOptionResolverContext,
} from '../index'
import {
  renderAntdVueChoiceReadonly,
  renderAntdVuePasswordReadonly,
  renderAntdVueRawReadonly,
  renderAntdVueSwitchReadonly,
} from '../src/readonly'

const expectedKeys = [
  'antd.input',
  'antd.password',
  'antd.search',
  'antd.textarea',
  'antd.input-number',
  'antd.select',
  'antd.auto-complete',
  'antd.radio',
  'antd.checkbox',
  'antd.switch',
  'antd.slider',
  'antd.rate',
  'antd.date',
  'antd.time',
  'antd.section',
  'antd.card',
  'antd.tabs',
  'antd.tab-pane',
  'antd.collapse',
  'antd.collapse-item',
  'antd.flex',
  'antd.grid',
]

function graphForRootMaterials(): PageGraph {
  const registry = createAntdVueDesignerRegistry()
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

function fieldNode(component: string, field: string): FieldNode {
  return {
    id: field,
    kind: 'field',
    component,
    field,
    props: {},
    events: {},
    bindings: {},
  }
}

describe('ant design vue designer materials', () => {
  it('registers every material and matching locale module', () => {
    const entries = ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.modules.list()
    expect(entries.map(entry => entry.name)).toEqual(expectedKeys.map(key => key.replace('antd.', '')))
    expect(entries.every(entry => entry.source === `./materials/${entry.name}.ts`)).toBe(true)
    expect(ANTD_VUE_DESIGNER_MATERIALS.map(material => material.key)).toEqual(expectedKeys)
    expect(Object.keys(ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.locales)).toEqual(expectedKeys)
    expect(Object.keys(ANTD_VUE_DESIGNER_ZH_CN.materials ?? {})).toEqual(expectedKeys)
  })

  it('publishes one complete four-capability contract for every material', () => {
    const capabilities = ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.capabilities
    expect(capabilities.map(entry => entry.contract.key)).toEqual(expectedKeys)
    expect(ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.contracts).toHaveLength(expectedKeys.length)
    for (const entry of capabilities) {
      expect(ANTD_VUE_DESIGNER_MATERIAL_REGISTRY.get(entry.contract.key)).toBe(entry)
      expect(entry.runtime.component).toBe(entry.contract.key)
      expect(entry.runtime.contractVersion).toBe(entry.contract.version)
      expect(entry.design.component).toBe(entry.contract.key)
      expect(entry.design.contractVersion).toBe(entry.contract.version)
      expect(entry.source).toMatchObject({
        component: entry.contract.key,
        contractVersion: entry.contract.version,
      })
      expect(() => structuredClone(entry.contract)).not.toThrow()
      expect(JSON.stringify(entry.contract)).not.toContain('component:')
      expect(Object.values(entry.contract).some(value => typeof value === 'function')).toBe(false)
    }
  })

  it('creates a normalized JSON-safe subgraph for every material', () => {
    const graph = graphForRootMaterials()
    expect(() => pageGraphSchema.parse(graph)).not.toThrow()
    expect(Object.keys(graph.nodesById)).toHaveLength(expectedKeys.length)
  })

  it('creates structural tabs and collapse children inside their real parent slots', () => {
    const registry = createAntdVueDesignerRegistry()
    const tabs = registry.createSubgraph('antd.tabs', { id: 'tabs' })
    const collapse = registry.createSubgraph('antd.collapse', { id: 'collapse' })

    expect(tabs.nodesById.tabs).toMatchObject({
      kind: 'layout',
      component: 'antd.tabs',
      slots: { default: [{ nodeId: 'tabs-pane-1', placement: {} }] },
    })
    expect(tabs.nodesById['tabs-pane-1']).toMatchObject({
      kind: 'layout',
      component: 'antd.tab-pane',
    })
    expect(collapse.nodesById.collapse).toMatchObject({
      kind: 'layout',
      component: 'antd.collapse',
      slots: { default: [{ nodeId: 'collapse-item-1', placement: {} }] },
    })
    expect(collapse.nodesById['collapse-item-1']).toMatchObject({
      kind: 'layout',
      component: 'antd.collapse-item',
    })
  })

  it('publishes complete source, binding, event, and property-control metadata', () => {
    const registry = createAntdVueDesignerRegistry()
    expect(registry.listMaterials().every(material => !!material.source)).toBe(true)
    expect(registry.getMaterial('antd.date')?.source?.tag).toBe('a-date-picker')
    expect(registry.getMaterial('antd.checkbox')?.source?.options).toEqual({ mode: 'prop' })
    expect(registry.getMaterial('antd.input')?.runtime).toMatchObject({
      valueProp: 'value',
      trigger: 'update:value',
    })
    expect(registry.getMaterial('antd.switch')?.runtime).toMatchObject({
      valueProp: 'checked',
      trigger: 'update:checked',
    })
    expect(registry.getMaterial('antd.search')?.events).toEqual([
      { name: 'search', title: 'Search' },
    ])
    expect(registry.getMaterial('antd.tabs')?.events).toEqual([
      { name: 'change', title: 'Active tab change' },
    ])
    expect(registry.getMaterial('antd.collapse')?.events).toEqual([
      { name: 'change', title: 'Expanded items change' },
    ])
    expect(Object.keys(registry.propertyControls)).toEqual(['text', 'textarea', 'number', 'boolean', 'select'])
  })

  it('creates independent defaults for every field material', () => {
    const registry = createAntdVueDesignerRegistry()
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

  it('renders semantic readonly values against canonical field nodes', async () => {
    const select = fieldNode('antd.select', 'environment')
    const autoComplete = fieldNode('antd.auto-complete', 'project')
    const password = fieldNode('antd.password', 'password')
    const switchNode = fieldNode('antd.switch', 'enabled')

    expect(renderAntdVueChoiceReadonly({
      node: select,
      model: { environment: 'a' },
      value: 'a',
      componentProps: { options: [{ label: 'Playground', value: 'a' }] },
    })).toBe('Playground')
    expect(renderAntdVueSwitchReadonly({
      node: switchNode,
      model: { enabled: true },
      value: true,
      componentProps: { checkedChildren: 'Enabled', unCheckedChildren: 'Disabled' },
    })).toBe('Enabled')
    expect(renderAntdVueRawReadonly({
      node: select,
      model: { environment: 'free text' },
      value: 'free text',
      componentProps: {},
    })).toBe('free text')
    expect(renderAntdVuePasswordReadonly({
      node: password,
      model: { password: 'secret' },
      value: 'secret',
      componentProps: {},
    })).toBe('********')

    const optionResolver = createAntdVueOptionResolverContext({
      dictionaries: { projects: [{ label: 'Project A', value: 'a' }] },
    })
    const dynamicReadonly = renderAntdVueChoiceReadonly({
      node: autoComplete,
      model: { project: 'a' },
      value: 'a',
      componentProps: { optionSource: { kind: 'dictionary', key: 'projects' } },
    })
    const readonlyHost = defineComponent({ setup: () => () => dynamicReadonly })
    const readonlyWrapper = mount(readonlyHost, {
      global: { provide: { [ANTD_VUE_OPTION_RESOLVER_KEY as symbol]: optionResolver } },
    })
    await flushPromises()
    expect(readonlyWrapper.text()).toBe('Project A')
  })

  it('keeps caller registry layers above provider defaults', () => {
    const override: DesignerMaterialDefinition = {
      key: 'antd.input',
      version: 1,
      kind: 'field',
      title: 'Override input',
      category: 'Custom',
      runtime: { component: 'input' },
      setters: [],
      createNode: ({ id, field = id }) => ({ id, field, kind: 'field', component: 'antd.input' }),
    }
    const registry = createAntdVueDesignerRegistry([{ name: 'override', materials: [override] }])

    expect(registry.rendererNamespace).toBe('mx-antd-config-form')
    expect(registry.getMaterial('antd.input')?.title).toBe('Override input')
    expect(registry.listMaterials()).toHaveLength(expectedKeys.length)
    expect(registry.createSubgraph('antd.input', { id: 'custom', field: 'custom' }).nodesById.custom)
      .toMatchObject({ component: 'antd.input', field: 'custom' })
  })
})
