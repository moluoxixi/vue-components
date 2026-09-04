import type { PageGraph } from '@moluoxixi/config-form-model'
import { defineDesignerFieldMaterial } from '@moluoxixi/config-form-designer'
import { pageGraphSchema } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
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
    expect(entries.every(entry => entry.source === `./${entry.name}.ts`)).toBe(true)
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.map(material => material.key)).toEqual(expectedKeys)
    expect(Object.keys(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.locales)).toEqual(expectedKeys)
    expect(Object.keys(ELEMENT_PLUS_DESIGNER_ZH_CN.materials ?? {})).toEqual(expectedKeys)
  })

  it('publishes one complete four-capability contract for every material', () => {
    const capabilities = ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.capabilities
    expect(capabilities.map(entry => entry.contract.key)).toEqual(expectedKeys)
    expect(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.contracts).toHaveLength(expectedKeys.length)
    for (const entry of capabilities) {
      expect(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.get(entry.contract.key)).toBe(entry)
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
    expect(Object.keys(registry.propertyControls)).toEqual(['defaultValue', 'text', 'textarea', 'number', 'boolean', 'select'])
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

  it('keeps factory-backed field setters and node defaults exact', () => {
    const registry = createElementPlusDesignerRegistry()
    const expected: Record<string, {
      constraints?: Record<string, Record<string, number>>
      field: string
      props: Record<string, unknown>
      readonlyProp: string
      setters: string[]
      valueKind: string
    }> = {
      'element.input': {
        setters: ['defaultValue:defaultValue', 'placeholder:text', 'clearable:boolean', 'maxlength:number'],
        field: 'input',
        props: { placeholder: '' },
        readonlyProp: 'readonly',
        valueKind: 'text',
        constraints: { maxlength: { min: 0, step: 1 } },
      },
      'element.textarea': {
        setters: ['defaultValue:defaultValue', 'placeholder:text', 'rows:number', 'maxlength:number'],
        field: 'textarea',
        props: { type: 'textarea', rows: 3, placeholder: '' },
        readonlyProp: 'readonly',
        valueKind: 'text',
        constraints: { rows: { min: 1, max: 20, step: 1 }, maxlength: { min: 0, step: 1 } },
      },
      'element.input-number': {
        setters: ['defaultValue:defaultValue', 'min:number', 'max:number', 'step:number', 'controls:boolean'],
        field: 'number',
        props: { step: 1, controls: true },
        readonlyProp: 'disabled',
        valueKind: 'number',
        constraints: { step: { min: 0 } },
      },
      'element.date': {
        setters: ['defaultValue:defaultValue', 'placeholder:text', 'clearable:boolean', 'format:text'],
        field: 'date',
        props: { type: 'date', valueFormat: 'YYYY-MM-DD', placeholder: '' },
        readonlyProp: 'readonly',
        valueKind: 'date',
      },
      'element.time': {
        setters: ['defaultValue:defaultValue', 'placeholder:text', 'clearable:boolean', 'format:text'],
        field: 'time',
        props: { valueFormat: 'HH:mm:ss', placeholder: '' },
        readonlyProp: 'readonly',
        valueKind: 'time',
      },
    }

    for (const [key, contract] of Object.entries(expected)) {
      const material = registry.getMaterial(key)
      expect(material?.kind).toBe('field')
      if (!material || material.kind !== 'field')
        continue
      expect(material.setters.map(setter => `${setter.key}:${setter.control}`)).toEqual(contract.setters)
      expect(material.setters[0]).toMatchObject({
        path: ['defaultValue'],
        valueKind: contract.valueKind,
      })
      expect(material.setters.slice(1).every(setter => setter.path.join('.') === `props.${setter.key}`)).toBe(true)
      for (const [key, constraints] of Object.entries(contract.constraints ?? {}))
        expect(material.setters.find(setter => setter.key === key)).toMatchObject(constraints)
      const valueProp = material.runtime.valueProp ?? 'modelValue'
      expect({
        valueProp,
        trigger: material.runtime.trigger ?? `update:${valueProp}`,
        readonlyProp: material.runtime.readonlyProp,
        readonlyRender: typeof material.runtime.readonlyRender,
      }).toEqual({
        valueProp: 'modelValue',
        trigger: 'update:modelValue',
        readonlyProp: contract.readonlyProp,
        readonlyRender: 'function',
      })
      expect(material.createNode({ id: 'node' })).toEqual({
        id: 'node',
        kind: 'field',
        component: key,
        field: contract.field,
        label: material.title,
        props: contract.props,
      })
    }
  })

  it('keeps direct materials above advanced layers and provider defaults', () => {
    const override = defineDesignerFieldMaterial({
      key: 'element.input',
      title: 'Override input',
      category: 'Custom',
      component: 'input',
    })
    const layered = defineDesignerFieldMaterial({
      key: 'element.input',
      title: 'Layered input',
      category: 'Custom',
      component: 'input',
    })
    const preview = defineComponent({ name: 'ProjectPreview' })
    const registry = createElementPlusDesignerRegistry({
      materials: [override],
      layers: [{
        name: 'custom-components',
        components: { 'project.preview': preview },
        materials: [layered],
      }],
    })
    const layeredRegistry = createElementPlusDesignerRegistry({
      layers: [{ name: 'custom-materials', materials: [layered] }],
    })

    expect(registry.getMaterial('element.input')?.title).toBe('Override input')
    expect(layeredRegistry.getMaterial('element.input')?.title).toBe('Layered input')
    expect(registry.components['project.preview']).toBe(preview)
    expect(registry.createSubgraph('element.input', { id: 'custom', field: 'custom' }).nodesById.custom)
      .toMatchObject({ component: 'element.input', field: 'custom' })
  })
})
