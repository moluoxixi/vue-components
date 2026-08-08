import type {
  DesignerDocument,
  DesignerJsonObject,
  DesignerMaterialDefinition,
} from '@moluoxixi/config-form-designer'
import { compileDesignerDocument } from '@moluoxixi/config-form-designer'
import { describe, expect, it } from 'vitest'
import {
  createElementPlusDesignerRegistry,
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
    expect(ELEMENT_PLUS_DESIGNER_MATERIALS.filter(material => material.kind === 'container')).toHaveLength(6)
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
