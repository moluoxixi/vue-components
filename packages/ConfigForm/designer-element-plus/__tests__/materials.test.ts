import type { DatasetViewQuery, ProjectDataset, SurfaceGraph } from '@moluoxixi/config-form-model'
import { defineDesignerFieldMaterial, isDesignerSetterPathAllowed } from '@moluoxixi/config-form-designer'
import { queryDatasetView, SURFACE_GRAPH_VERSION, surfaceGraphSchema } from '@moluoxixi/config-form-model'
import { flushPromises, mount } from '@vue/test-utils'
import { ElTable } from 'element-plus'
import { describe, expect, it } from 'vitest'
import { defineComponent, reactive, toRaw } from 'vue'
import {
  createElementPlusDesignerRegistry,
  ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY,
  ELEMENT_PLUS_DESIGNER_MATERIALS,
  ELEMENT_PLUS_DESIGNER_ZH_CN,
} from '../index'
import { ElementDatasetList, ElementDatasetTable } from '../src/materials/runtime'

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
  'element.object-group',
  'element.array-subform',
  'element.detail-table',
  'element.text',
  'element.title',
  'element.icon',
  'element.image',
  'element.divider',
  'element.button',
  'element.link',
  'element.tag',
  'element.alert',
  'element.table',
  'element.list',
  'element.empty',
  'element.pagination',
]

function graphForRootMaterials(): SurfaceGraph {
  const registry = createElementPlusDesignerRegistry()
  const graph: SurfaceGraph = { version: SURFACE_GRAPH_VERSION, props: {}, form: {}, root: [], nodesById: {} }
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

function projectedDatasetViews() {
  const dataset: ProjectDataset = {
    id: 'people',
    name: 'People',
    rows: [
      { id: 'ada', name: 'Ada', active: true, rank: 2, detail: 'Second', meta: { team: 'Core' } },
      { id: 'grace', name: 'Grace', active: false, rank: 4, detail: 'Hidden', meta: { team: 'Compiler' } },
      { id: 'linus', name: 'Linus', active: true, rank: 1, detail: 'Third', meta: { team: 'Runtime' } },
      { id: 'alan', name: 'Alan', active: true, rank: 3, detail: 'First', meta: { team: 'Studio' } },
    ],
  }
  const query: DatasetViewQuery = {
    filter: { version: 1, ast: { kind: 'reference', scope: 'item', path: ['active'] } },
    sort: [{ path: ['rank'], direction: 'desc' }],
    page: { index: 0, size: 2 },
  }
  const table = queryDatasetView(dataset, {
    kind: 'table',
    rowKeyPath: ['id'],
    columns: [
      { key: 'name', valuePath: ['name'] },
      { key: 'meta', valuePath: ['meta'] },
    ],
  }, query)
  const list = queryDatasetView(dataset, {
    kind: 'list',
    itemKeyPath: ['id'],
    titlePath: ['name'],
    descriptionPath: ['detail'],
  }, query)
  if (!table.success || !list.success)
    throw new TypeError('Expected shared Dataset queries to succeed.')
  return { table: table.data, list: list.data }
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
    expect(() => surfaceGraphSchema.parse(graph)).not.toThrow()
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

  it('publishes source and binding metadata without event authoring capabilities', () => {
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
    expect(registry.listMaterials().every(material => !Object.hasOwn(material, 'events'))).toBe(true)
    expect(ELEMENT_PLUS_DESIGNER_MATERIAL_REGISTRY.contracts.every(contract => !Object.hasOwn(contract, 'events'))).toBe(true)
    expect(registry.listMaterials().flatMap(material => material.setters).every(setter => isDesignerSetterPathAllowed(setter.path))).toBe(true)
    expect(registry.listMaterials().flatMap(material => material.setters).some(setter => setter.path.join('.') === 'props.optionSource')).toBe(false)
    expect(registry.listMaterials().flatMap(material => material.setters).some(setter => setter.path[0] === 'valueScope')).toBe(false)
    expect(Object.keys(registry.propertyControls)).toEqual(['defaultValue'])
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

  it('keeps Dataset and semantic capabilities on their exact element materials', () => {
    const registry = createElementPlusDesignerRegistry()
    for (const name of ['text', 'title', 'icon', 'image', 'divider', 'button', 'link', 'tag', 'alert', 'table', 'list', 'empty', 'pagination'])
      expect(registry.getMaterial(`element.${name}`)?.kind).toBe('element')
    expect(registry.getMaterial('element.select')?.datasetBindings).toEqual([
      { key: 'options', projectionKinds: ['options'] },
    ])
    expect(registry.getMaterial('element.table')).toMatchObject({
      kind: 'element',
      semanticTriggers: ['rowActivate'],
      datasetBindings: [{ key: 'rows', projectionKinds: ['table'] }],
    })
    expect(registry.getMaterial('element.list')).toMatchObject({
      kind: 'element',
      semanticTriggers: ['itemActivate'],
      datasetBindings: [{ key: 'items', projectionKinds: ['list'] }],
    })
    expect(registry.getMaterial('element.button')?.semanticTriggers).toEqual(['activate'])
    expect(registry.getMaterial('element.link')?.semanticTriggers).toEqual(['activate'])
    expect(registry.getMaterial('element.image')?.resourceBindings).toEqual([{ key: 'src', mediaTypes: ['image/*'] }])
    const grid = registry.getMaterial('element.grid')
    const flex = registry.getMaterial('element.flex')
    expect(grid?.kind).toBe('layout')
    expect(flex?.kind).toBe('layout')
    if (grid?.kind === 'layout')
      expect(grid.slots[0]?.accepts).toContain('element')
    if (flex?.kind === 'layout')
      expect(flex.slots[0]?.accepts).toContain('element')
  })

  it('renders the shared queried Dataset page with local Table/List activation state', async () => {
    const views = projectedDatasetViews()
    expect(views.table).toMatchObject({
      total: 3,
      items: [
        { rowKey: 'alan', name: 'Alan' },
        { rowKey: 'ada', name: 'Ada' },
      ],
    })
    expect(views.list).toMatchObject({
      total: 3,
      items: [
        { itemKey: 'alan', title: 'Alan', description: 'First' },
        { itemKey: 'ada', title: 'Ada', description: 'Second' },
      ],
    })

    const rows = reactive([...views.table.items])
    const table = mount(ElementDatasetTable, { props: { rows, rowsTotal: views.table.total } })
    const elTable = table.getComponent(ElTable)
    const rowClassName = elTable.props('rowClassName') as (input: {
      row: Record<string, unknown>
      rowIndex: number
    }) => string
    expect(table.get('.el-business-table__summary').text()).toBe('2 / 3')
    elTable.vm.$emit('row-click', rows[0])
    await flushPromises()
    expect(rowClassName({ row: rows[0]!, rowIndex: 0 })).toBe('is-selected')
    const activatedRow = table.emitted('row-click')?.[0]?.[0] as typeof rows[number]
    expect(activatedRow).toEqual(toRaw(rows[0]))
    expect(activatedRow).not.toBe(toRaw(rows[0]))
    expect(activatedRow.meta).not.toBe(toRaw(rows[0]!).meta)

    const items = reactive([...views.list.items])
    const list = mount(ElementDatasetList, { props: { items, itemsTotal: views.list.total } })
    const first = list.get('.el-business-list__item')
    expect(list.get('.el-business-list__summary').text()).toBe('2 / 3')
    await first.trigger('click')
    expect(first.attributes('aria-pressed')).toBe('true')
    expect(first.classes()).toContain('is-selected')
    const activatedItem = list.emitted('item-click')?.[0]?.[0] as typeof items[number]
    expect(activatedItem).toEqual(toRaw(items[0]))
    expect(activatedItem).not.toBe(toRaw(items[0]))
  })

  it('shares one option value capability across options and default setters', () => {
    const registry = createElementPlusDesignerRegistry()
    const expected = {
      'element.select': ['string', 'number', 'boolean'],
      'element.radio': ['string', 'number', 'boolean'],
      'element.checkbox': ['string', 'number'],
    } as const

    for (const [key, optionValueTypes] of Object.entries(expected)) {
      const material = registry.getMaterial(key)
      expect(material?.kind).toBe('field')
      const defaultSetter = material?.setters.find(setter => setter.path.join('.') === 'defaultValue')
      const optionsSetter = material?.setters.find(setter => setter.path.join('.') === 'props.options')
      expect(defaultSetter?.optionValueTypes).toEqual(optionValueTypes)
      expect(defaultSetter?.componentProps).toMatchObject({ optionValueTypes })
      expect(optionsSetter?.optionValueTypes).toEqual(optionValueTypes)
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
