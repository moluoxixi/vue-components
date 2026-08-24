import type {
  DesignerDocument,
  DesignerMaterialDefinition,
  DesignerPropertySetterDefinition,
} from '../index'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import {
  analyzeDesignerDocument,
  createDesignerMaterialModuleRegistry,
  createDesignerRegistry,
  defineDesignerMaterialModule,
  DesignerRegistryError,
} from '../index'

function fieldMaterial(
  title: string,
  key = 'element.input',
  setters: DesignerPropertySetterDefinition[] = [],
): DesignerMaterialDefinition {
  return {
    key,
    version: 1,
    kind: 'field',
    title,
    category: 'Fields',
    runtime: { component: 'input' },
    setters,
    createNode: ({ id, field = 'field' }) => ({
      id,
      kind: 'field',
      material: key,
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
  it('collects co-located material definitions and locale from named modules', () => {
    const material = fieldMaterial('Input')
    const catalog = createDesignerMaterialModuleRegistry({
      './materials/input.ts': {
        default: defineDesignerMaterialModule({
          name: 'input',
          order: 10,
          value: {
            material,
            locale: { title: '输入框', setters: { placeholder: '占位文本' } },
          },
        }),
      },
    })

    expect(catalog.materials).toEqual([material])
    expect(catalog.locales).toEqual({
      'element.input': { title: '输入框', setters: { placeholder: '占位文本' } },
    })
    expect(catalog.modules.list()[0]).toMatchObject({
      name: 'input',
      source: './materials/input.ts',
    })
  })

  it('rejects a material key whose final segment differs from its module name', () => {
    expect(() => createDesignerMaterialModuleRegistry({
      './materials/text.ts': defineDesignerMaterialModule({
        name: 'text',
        value: { material: fieldMaterial('Input') },
      }),
    })).toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
      code: 'DESIGNER_MATERIAL_MODULE_KEY_MISMATCH',
    }))
  })

  it('reports malformed material module values with a stable registry error', () => {
    expect(() => createDesignerMaterialModuleRegistry({
      './materials/input.ts': {
        name: 'input',
        value: undefined,
      } as never,
    })).toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
      code: 'DESIGNER_MATERIAL_MODULE_INVALID',
      context: { moduleName: 'input', source: './materials/input.ts' },
    }))
  })

  it('uses the first layer as the highest precedence and validates factories', () => {
    const localControl = defineComponent({ name: 'LocalControl' })
    const adapterControl = defineComponent({ name: 'AdapterControl' })
    const numberControl = defineComponent({ name: 'NumberControl' })
    const registry = createDesignerRegistry([
      {
        name: 'local',
        components: { text: { component: localControl, trigger: 'update:modelValue' } },
        materials: [fieldMaterial('Local input')],
        propertyControls: { text: { component: 'textarea', trigger: 'change' } },
      },
      {
        name: 'adapter',
        components: { text: adapterControl, number: numberControl },
        materials: [fieldMaterial('Adapter input')],
        propertyControls: {
          text: { component: 'input' },
          number: { component: 'input', valueProp: 'value' },
        },
      },
    ])

    expect(registry.getMaterial('element.input')?.title).toBe('Local input')
    expect(registry.rendererNamespace).toBe('mx-config-form')
    expect(registry.components.text).toMatchObject({
      component: localControl,
      trigger: 'update:modelValue',
    })
    expect(registry.components.number).toBe(numberControl)
    expect(registry.propertyControls).toMatchObject({
      text: { component: 'textarea', trigger: 'change' },
      number: { component: 'input', valueProp: 'value' },
    })
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
    expect(() => createDesignerRegistry([{
      name: 'adapter',
      components: { '': defineComponent({ name: 'InvalidControl' }) },
    }])).toThrowError(DesignerRegistryError)
    expect(() => createDesignerRegistry([{
      name: 'adapter',
      components: Object.fromEntries([['__proto__', defineComponent({ name: 'UnsafeControl' })]]),
    }])).toThrow(/component key is unsafe: __proto__/i)
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

  it('exposes an adapter runtime namespace for WYSIWYG field markup', () => {
    const registry = createDesignerRegistry(
      [{ name: 'adapter', materials: [fieldMaterial('Input')] }],
      { rendererNamespace: 'mx-adapter-config-form' },
    )

    expect(registry.rendererNamespace).toBe('mx-adapter-config-form')
  })

  it('diagnoses default value kinds and static option membership without rejecting null', () => {
    const textDefault: DesignerPropertySetterDefinition = {
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'text',
    }
    const selectDefault: DesignerPropertySetterDefinition = {
      ...textDefault,
      valueKind: 'select',
      optionsPath: ['props', 'options'],
    }
    const registry = createDesignerRegistry([{
      name: 'adapter',
      materials: [
        fieldMaterial('Input', 'element.input', [textDefault]),
        fieldMaterial('Select', 'element.select', [selectDefault]),
      ],
    }])
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [
        {
          id: 'name',
          kind: 'field',
          material: 'element.input',
          field: 'name',
          defaultValue: 42,
        },
        {
          id: 'environment',
          kind: 'field',
          material: 'element.select',
          field: 'environment',
          defaultValue: 'missing',
          props: { options: [{ label: 'Playground', value: 'playground' }] },
        },
        {
          id: 'optional',
          kind: 'field',
          material: 'element.select',
          field: 'optional',
          defaultValue: null,
          props: { options: [{ label: 'Playground', value: 'playground' }] },
        },
      ],
    }

    expect(analyzeDesignerDocument(document, registry)).toEqual([
      expect.objectContaining({
        code: 'DESIGNER_DEFAULT_KIND_INVALID',
        nodeId: 'name',
        path: ['nodes', 0, 'defaultValue'],
        severity: 'error',
      }),
      expect.objectContaining({
        code: 'DESIGNER_DEFAULT_OPTION_UNKNOWN',
        nodeId: 'environment',
        path: ['nodes', 1, 'defaultValue'],
        severity: 'error',
      }),
    ])
  })
})
