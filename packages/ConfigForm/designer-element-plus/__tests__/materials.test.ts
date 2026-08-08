import type {
  DesignerDocument,
  DesignerJsonObject,
  DesignerMaterialDefinition,
} from '@moluoxixi/config-form-designer'
import { compileDesignerDocument } from '@moluoxixi/config-form-designer'
import { describe, expect, it } from 'vitest'
import {
  createElementPlusDesignerRegistry,
  createElementPlusOptionResolverContext,
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

describe('element plus designer materials', () => {
  it('ships a locale map for every registered material', () => {
    expect(Object.keys(ELEMENT_PLUS_DESIGNER_ZH_CN.materials ?? {})).toEqual(expectedKeys)
    expect(ELEMENT_PLUS_DESIGNER_ZH_CN.messages?.['designer.title']).toBe('表单设计器')
    expect(ELEMENT_PLUS_DESIGNER_ZH_CN.materials?.['element.input']?.setters?.placeholder).toBe('占位文本')
  })

  it('registers the complete MVP field and container set', () => {
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.map(material => material.key)).toEqual(expectedKeys)
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.filter(material => material.kind === 'field')).toHaveLength(9)
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.filter(material => material.kind === 'container')).toHaveLength(8)
  })

  it('provides typed visual default-value setters and readonly preview bindings', () => {
    const fields = ELEMENT_PLUS_DESIGNER_MATERIALS.filter(material => material.kind === 'field')
    expect(fields.every(material => material.setters.some(setter => setter.path.join('.') === 'defaultValue'))).toBe(true)
    expect(Object.fromEntries(fields.map(material => [material.key, material.runtime.readonlyProp]))).toEqual({
      'element.input': 'readonly',
      'element.textarea': 'readonly',
      'element.input-number': 'disabled',
      'element.select': 'disabled',
      'element.radio': 'disabled',
      'element.checkbox': 'disabled',
      'element.switch': 'disabled',
      'element.date': 'readonly',
      'element.time': 'readonly',
    })

    const select = fields.find(material => material.key === 'element.select')!
    expect(select.setters.find(setter => setter.key === 'defaultValue')).toMatchObject({
      control: 'custom',
      valueKind: 'select',
    })
    expect(select.setters.find(setter => setter.key === 'optionSource')).toMatchObject({
      control: 'custom',
      path: ['props', 'optionSource'],
    })
    expect(select.runtime.readonlyProp).toBe('disabled')

    const checkbox = fields.find(material => material.key === 'element.checkbox')!
    expect(checkbox.setters.find(setter => setter.key === 'defaultValue')).toMatchObject({
      valueKind: 'multiselect',
    })
  })

  it('creates valid independent defaults with JSON-safe date and time values', () => {
    const registry = createElementPlusDesignerRegistry()
    const selectOne = registry.createNode('element.select', { id: 'select-1', field: 'choiceOne' })
    const selectTwo = registry.createNode('element.select', { id: 'select-2', field: 'choiceTwo' })
    const firstOptions = selectOne.props?.options as DesignerJsonObject[]
    firstOptions[0]!.label = 'Changed'
    expect((selectTwo.props?.options as DesignerJsonObject[])[0]?.label).toBe('Option A')

    expect(registry.createNode('element.date', { id: 'date', field: 'date' })).toMatchObject({
      props: { valueFormat: 'YYYY-MM-DD' },
    })
    expect(registry.createNode('element.time', { id: 'time', field: 'time' })).toMatchObject({
      props: { valueFormat: 'HH:mm:ss' },
    })
    expect(registry.createNode('element.checkbox', { id: 'tags', field: 'tags' })).toMatchObject({
      defaultValue: [],
    })
  })

  it('enforces finite tabs and collapse child materials during compilation', () => {
    const registry = createElementPlusDesignerRegistry()
    const invalid: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'tabs',
        kind: 'container',
        material: 'element.tabs',
        slots: {
          default: [{
            id: 'input',
            kind: 'field',
            material: 'element.input',
            field: 'input',
          }],
        },
      }],
    }
    expect(compileDesignerDocument(invalid, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_SLOT_KIND_INVALID' }, { code: 'DESIGNER_SLOT_MATERIAL_INVALID' }],
    })

    const valid: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'tabs',
        kind: 'container',
        material: 'element.tabs',
        slots: {
          default: [{
            id: 'pane',
            kind: 'container',
            material: 'element.tab-pane',
            props: { label: 'Profile', name: 'profile' },
            slots: {
              default: [{
                id: 'input',
                kind: 'field',
                material: 'element.input',
                field: 'name',
              }],
            },
          }],
        },
      }],
    }
    expect(compileDesignerDocument(valid, registry).success).toBe(true)
  })

  it('compiles real flex and grid layout containers with nested fields', () => {
    const registry = createElementPlusDesignerRegistry()
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'grid',
        kind: 'container',
        material: 'element.grid',
        props: { columns: 3, gap: 16 },
        slots: {
          default: [{
            id: 'flex',
            kind: 'container',
            material: 'element.flex',
            props: { wrap: true, gap: 8 },
            slots: {
              default: [{
                id: 'name',
                kind: 'field',
                material: 'element.input',
                field: 'name',
              }],
            },
          }],
        },
      }],
    }

    const compiled = compileDesignerDocument(document, registry)
    expect(compiled.success).toBe(true)
    if (!compiled.success)
      return

    expect(compiled.fields[0]).toMatchObject({
      component: expect.anything(),
      props: { columns: 3, gap: 16 },
    })
    const grid = compiled.fields[0]!
    const flex = Array.isArray(grid.slots?.default) ? grid.slots.default[0] : undefined
    expect(flex).toMatchObject({ props: { wrap: true, gap: 8 } })
    const nestedField = flex && Array.isArray(flex.slots?.default) ? flex.slots.default[0] : undefined
    expect(nestedField).toMatchObject({ field: 'name' })
  })

  it('validates dictionary defaults against normalized resolved options', () => {
    const optionResolver = createElementPlusOptionResolverContext({
      dictionaries: {
        environments: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    })
    const registry = createElementPlusDesignerRegistry([], { optionResolver })
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'environment',
        kind: 'field',
        material: 'element.select',
        field: 'environment',
        defaultValue: 'playground',
        props: { optionSource: { kind: 'dictionary', key: 'environments' } },
      }],
    }

    expect(compileDesignerDocument(document, registry).success).toBe(true)
    const environment = document.nodes[0]
    if (environment?.kind !== 'field')
      throw new Error('Expected field fixture')
    environment.defaultValue = 'missing'
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DEFAULT_OPTION_UNKNOWN', nodeId: 'environment' }],
    })
    environment.defaultValue = null
    expect(compileDesignerDocument(document, registry).success).toBe(true)

    environment.defaultValue = undefined
    environment.props = { optionSource: { kind: 'provider' } }
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_OPTION_SOURCE_INVALID', nodeId: 'environment' }],
    })
  })

  it('tracks provider resolution states and blocks unresolved defaults', () => {
    const optionResolver = createElementPlusOptionResolverContext()
    const registry = createElementPlusDesignerRegistry([], { optionResolver })
    const optionSource = { kind: 'provider' as const, key: 'projects' }
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'project',
        kind: 'field',
        material: 'element.select',
        field: 'project',
        defaultValue: 'website',
        props: { optionSource },
      }],
    }

    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_OPTION_SOURCE_UNRESOLVED', nodeId: 'project' }],
    })
    optionResolver.writeState(optionSource, { status: 'loading', options: [] })
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_OPTION_SOURCE_LOADING', nodeId: 'project' }],
    })
    optionResolver.writeState(optionSource, {
      status: 'ready',
      options: [{ label: 'Website', value: 'website' }],
    })
    expect(compileDesignerDocument(document, registry).success).toBe(true)

    optionResolver.writeState(optionSource, {
      status: 'ready',
      options: [{ label: 'Admin', value: 'admin' }],
    })
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DEFAULT_OPTION_UNKNOWN', nodeId: 'project' }],
    })

    optionResolver.writeState(optionSource, { status: 'error', options: [], error: 'Provider failed' })
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_OPTION_SOURCE_ERROR', message: 'Provider failed' }],
    })
  })

  it('keeps caller layers above adapter defaults', () => {
    const localInput: DesignerMaterialDefinition = {
      key: 'element.input',
      version: 1,
      kind: 'field',
      title: 'Local input',
      category: 'Local',
      runtime: { component: 'input' },
      setters: [],
      createNode: ({ id, field = 'local' }) => ({
        id,
        kind: 'field',
        material: 'element.input',
        field,
      }),
    }
    const registry = createElementPlusDesignerRegistry([{ name: 'local', materials: [localInput] }])
    expect(registry.getMaterial('element.input')?.title).toBe('Local input')
    expect(registry.listMaterials()).toHaveLength(expectedKeys.length)
  })
})
