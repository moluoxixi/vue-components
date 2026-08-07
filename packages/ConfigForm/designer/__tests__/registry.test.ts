import type {
  DesignerDocument,
  DesignerMaterialDefinition,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  analyzeDesignerDocument,
  createDesignerRegistry,
  DesignerRegistryError,
} from '../index'

function fieldMaterial(title: string): DesignerMaterialDefinition {
  return {
    key: 'element.input',
    version: 1,
    kind: 'field',
    title,
    category: 'Fields',
    runtime: { component: 'input' },
    setters: [],
    createNode: ({ id, field = 'field' }) => ({
      id,
      kind: 'field',
      material: 'element.input',
      field,
    }),
  }
}

function containerMaterial(min?: number): DesignerMaterialDefinition {
  return {
    key: 'element.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    runtime: { component: 'section' },
    setters: [],
    slots: [{
      name: 'default',
      title: 'Content',
      accepts: ['field'],
      ...(min === undefined ? {} : { min }),
    }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      slots: { default: [] },
    }),
  }
}

describe('designer registry', () => {
  it('uses the first layer as the highest precedence and validates factories', () => {
    const registry = createDesignerRegistry([
      { name: 'local', materials: [fieldMaterial('Local input')] },
      { name: 'adapter', materials: [fieldMaterial('Adapter input')] },
    ])

    expect(registry.getMaterial('element.input')?.title).toBe('Local input')
    expect(registry.createNode('element.input', { id: 'name', field: 'name' })).toEqual({
      id: 'name',
      kind: 'field',
      material: 'element.input',
      field: 'name',
    })
  })

  it('rejects duplicate keys inside one layer', () => {
    expect(() => createDesignerRegistry([{
      name: 'adapter',
      materials: [fieldMaterial('One'), fieldMaterial('Two')],
    }])).toThrowError(DesignerRegistryError)
  })

  it('reports unknown materials and illegal slot children', () => {
    const registry = createDesignerRegistry([{
      name: 'adapter',
      materials: [fieldMaterial('Input'), containerMaterial()],
    }])
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [
        {
          id: 'section',
          kind: 'container',
          material: 'element.section',
          slots: {
            default: [{
              id: 'nested',
              kind: 'container',
              material: 'element.section',
              slots: { default: [] },
            }],
          },
        },
        {
          id: 'unknown',
          kind: 'field',
          material: 'element.missing',
          field: 'unknown',
        },
      ],
    }

    expect(analyzeDesignerDocument(document, registry)).toEqual([
      expect.objectContaining({ code: 'DESIGNER_SLOT_KIND_INVALID', nodeId: 'nested' }),
      expect.objectContaining({ code: 'DESIGNER_MATERIAL_UNKNOWN', nodeId: 'unknown' }),
    ])
  })

  it('reports a required material slot when the document omits its key', () => {
    const registry = createDesignerRegistry([{
      name: 'adapter',
      materials: [containerMaterial(1)],
    }])
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'section',
        kind: 'container',
        material: 'element.section',
        slots: {},
      }],
    }

    expect(analyzeDesignerDocument(document, registry)).toEqual([
      expect.objectContaining({
        code: 'DESIGNER_SLOT_MIN_UNMET',
        nodeId: 'section',
        path: ['nodes', 0, 'slots', 'default'],
      }),
    ])
  })
})
