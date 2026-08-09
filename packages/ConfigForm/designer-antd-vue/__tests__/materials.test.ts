import type {
  DesignerDocument,
  DesignerJsonObject,
  DesignerMaterialDefinition,
} from '@moluoxixi/config-form-designer'
import { compileDesignerDocument } from '@moluoxixi/config-form-designer'
import { describe, expect, it } from 'vitest'
import {
  ANTD_VUE_DESIGNER_MATERIALS,
  ANTD_VUE_DESIGNER_ZH_CN,
  createAntdVueDesignerRegistry,
  createAntdVueOptionResolverContext,
} from '../index'
import {
  renderAntdVueChoiceReadonly,
  renderAntdVueRawReadonly,
  renderAntdVueSwitchReadonly,
} from '../src/readonly'

const expectedKeys = [
  'antd.input',
  'antd.textarea',
  'antd.input-number',
  'antd.select',
  'antd.radio',
  'antd.checkbox',
  'antd.switch',
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

describe('ant design vue designer materials', () => {
  it('registers the complete material set with localized metadata', () => {
    expect(ANTD_VUE_DESIGNER_MATERIALS.map(material => material.key)).toEqual(expectedKeys)
    expect(Object.keys(ANTD_VUE_DESIGNER_ZH_CN.materials ?? {})).toEqual(expectedKeys)
    expect(ANTD_VUE_DESIGNER_MATERIALS.filter(material => material.kind === 'field')).toHaveLength(9)
    expect(ANTD_VUE_DESIGNER_MATERIALS.filter(material => material.kind === 'container')).toHaveLength(8)
  })

  it('uses native Ant Design Vue value and checked bindings', () => {
    const fields = ANTD_VUE_DESIGNER_MATERIALS.filter(material => material.kind === 'field')
    expect(fields.every(material => material.setters.some(setter => setter.path.join('.') === 'defaultValue'))).toBe(true)
    expect(fields.every(material => typeof material.runtime.readonlyRender === 'function')).toBe(true)
    expect(Object.fromEntries(fields.map(material => [material.key, {
      valueProp: material.runtime.valueProp,
      trigger: material.runtime.trigger,
    }]))).toEqual({
      'antd.input': { valueProp: 'value', trigger: 'update:value' },
      'antd.textarea': { valueProp: 'value', trigger: 'update:value' },
      'antd.input-number': { valueProp: 'value', trigger: 'update:value' },
      'antd.select': { valueProp: 'value', trigger: 'update:value' },
      'antd.radio': { valueProp: 'value', trigger: 'update:value' },
      'antd.checkbox': { valueProp: 'value', trigger: 'update:value' },
      'antd.switch': { valueProp: 'checked', trigger: 'update:checked' },
      'antd.date': { valueProp: 'value', trigger: 'update:value' },
      'antd.time': { valueProp: 'value', trigger: 'update:value' },
    })
  })

  it('renders semantic readonly choice and switch labels', () => {
    const registry = createAntdVueDesignerRegistry()
    const select = registry.createNode('antd.select', { id: 'select', field: 'environment' })
    const switchNode = registry.createNode('antd.switch', { id: 'switch', field: 'enabled' })
    if (select.kind !== 'field' || switchNode.kind !== 'field')
      throw new Error('Expected field fixtures')

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
  })

  it('creates independent JSON-safe defaults', () => {
    const registry = createAntdVueDesignerRegistry()
    const selectOne = registry.createNode('antd.select', { id: 'select-1', field: 'choiceOne' })
    const selectTwo = registry.createNode('antd.select', { id: 'select-2', field: 'choiceTwo' })
    const firstOptions = selectOne.props?.options as DesignerJsonObject[]
    firstOptions[0]!.label = 'Changed'
    expect((selectTwo.props?.options as DesignerJsonObject[])[0]?.label).toBe('Option A')
    expect(registry.createNode('antd.date', { id: 'date', field: 'date' })).toMatchObject({ props: { valueFormat: 'YYYY-MM-DD' } })
    expect(registry.createNode('antd.time', { id: 'time', field: 'time' })).toMatchObject({ props: { valueFormat: 'HH:mm:ss' } })
  })

  it('enforces tabs child materials and compiles nested layouts', () => {
    const registry = createAntdVueDesignerRegistry()
    const invalid: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'tabs',
        kind: 'container',
        material: 'antd.tabs',
        slots: { default: [{ id: 'input', kind: 'field', material: 'antd.input', field: 'input' }] },
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
        id: 'grid',
        kind: 'container',
        material: 'antd.grid',
        props: { columns: 3, gap: 16 },
        slots: { default: [{ id: 'name', kind: 'field', material: 'antd.input', field: 'name' }] },
      }],
    }
    expect(compileDesignerDocument(valid, registry)).toMatchObject({
      success: true,
      fields: [{ props: { columns: 3, gap: 16 } }],
    })
  })

  it('validates resolved dictionary defaults', () => {
    const optionResolver = createAntdVueOptionResolverContext({
      dictionaries: {
        environments: [
          { label: 'Playground', value: 'playground' },
          { label: 'Production', value: 'production' },
        ],
      },
    })
    const registry = createAntdVueDesignerRegistry([], { optionResolver })
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'environment',
        kind: 'field',
        material: 'antd.select',
        field: 'environment',
        defaultValue: 'playground',
        props: { optionSource: { kind: 'dictionary', key: 'environments' } },
      }],
    }
    expect(compileDesignerDocument(document, registry).success).toBe(true)
    const field = document.nodes[0]
    if (field?.kind !== 'field')
      throw new Error('Expected field fixture')
    field.defaultValue = 'missing'
    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DEFAULT_OPTION_UNKNOWN', nodeId: 'environment' }],
    })
  })

  it('keeps caller registry layers above adapter defaults', () => {
    const localInput: DesignerMaterialDefinition = {
      key: 'antd.input',
      version: 1,
      kind: 'field',
      title: 'Local input',
      category: 'Local',
      runtime: { component: 'input' },
      setters: [],
      createNode: ({ id, field = 'local' }) => ({ id, kind: 'field', material: 'antd.input', field }),
    }
    const registry = createAntdVueDesignerRegistry([{ name: 'local', materials: [localInput] }])
    expect(registry.getMaterial('antd.input')?.title).toBe('Local input')
    expect(registry.listMaterials()).toHaveLength(expectedKeys.length)
  })
})
