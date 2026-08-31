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
  createLowCodeComponentRegistry,
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
    source: { configComponent: 'text', render: 'component', tag: 'input' },
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
    source: { configComponent: 'div', render: 'section', tag: 'section' },
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

function structuralMaterials(): DesignerMaterialDefinition[] {
  const item: DesignerMaterialDefinition = {
    key: 'element.item',
    version: 1,
    kind: 'container',
    title: 'Item',
    category: 'Layout',
    runtime: { component: 'article' },
    source: { configComponent: 'div', render: 'section', tag: 'article' },
    allowedParents: [{ material: 'element.group', slot: 'default' }],
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.item',
      slots: { default: [] },
    }),
  }
  const group: DesignerMaterialDefinition = {
    key: 'element.group',
    version: 1,
    kind: 'container',
    title: 'Group',
    category: 'Layout',
    runtime: { component: 'section' },
    source: { configComponent: 'div', render: 'section', tag: 'section' },
    setters: [],
    slots: [{ name: 'default', title: 'Items', accepts: ['container'], materials: ['element.item'] }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.group',
      slots: { default: [] },
    }),
  }
  return [group, item]
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

  it('merges explicit component events with field binding events by canonical name', () => {
    const field = fieldMaterial('Input')
    field.events = [
      { name: 'click', title: 'Click' },
      { name: 'update:modelValue', title: 'Committed value' },
    ]
    const container = containerMaterial()
    container.events = [{ name: 'change', title: 'Section change' }]
    const registry = createLowCodeComponentRegistry(createDesignerRegistry([{
      name: 'adapter',
      materials: [field, container],
    }]))

    expect(registry.get('element.input')?.events).toEqual([
      { name: 'update:modelValue', displayName: 'Committed value' },
      { name: 'click', displayName: 'Click' },
    ])
    expect(registry.get('element.section')?.events).toEqual([
      { name: 'change', displayName: 'Section change' },
    ])
  })

  it('rejects malformed or duplicate material event declarations', () => {
    const empty = fieldMaterial('Input')
    empty.events = [{ name: '', title: 'Change' }]
    expect(() => createDesignerRegistry([{ name: 'adapter', materials: [empty] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_MATERIAL_EVENT_INVALID',
      }))

    const duplicate = fieldMaterial('Input')
    duplicate.events = [
      { name: 'change', title: 'Change' },
      { name: 'change', title: 'Another change' },
    ]
    expect(() => createDesignerRegistry([{ name: 'adapter', materials: [duplicate] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_MATERIAL_EVENT_INVALID',
      }))
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

  it('requires controlled adapters for unsafe design policies and exposes the normalized policy', () => {
    const invalid = fieldMaterial('Async input')
    invalid.designPolicy = { async: 'adapter' }
    expect(() => createDesignerRegistry([{ name: 'adapter', materials: [invalid] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_DESIGN_POLICY_ADAPTER_REQUIRED',
      }))

    const controlled = fieldMaterial('Async input')
    controlled.designPolicy = {
      async: 'adapter',
      adapter: defineComponent({ name: 'ControlledAsyncInput' }),
      visualEquivalence: 'runtime-geometry',
      diagnostic: 'Async behavior is isolated in Design mode.',
    }
    const registry = createDesignerRegistry([{ name: 'adapter', materials: [controlled] }])
    expect(createLowCodeComponentRegistry(registry).get('element.input')?.designPolicy).toMatchObject({
      render: 'adapter',
      interaction: 'preview',
      async: 'adapter',
      sideEffects: 'blocked',
      visualEquivalence: 'runtime-geometry',
      diagnostic: 'Async behavior is isolated in Design mode.',
    })

    const unproven = fieldMaterial('Unproven adapter')
    unproven.designPolicy = {
      render: 'adapter',
      adapter: defineComponent({ name: 'UnprovenAdapter' }),
    }
    expect(() => createDesignerRegistry([{ name: 'adapter', materials: [unproven] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_DESIGN_POLICY_EQUIVALENCE_REQUIRED',
      }))
  })

  it('requires an explicit source binding for low-code registration', () => {
    const material = fieldMaterial('Input')
    delete material.source
    const registry = createDesignerRegistry([{ name: 'adapter', materials: [material] }])

    expect(() => createLowCodeComponentRegistry(registry)).toThrow(/missing its source binding/i)
  })

  it('validates source bindings and exposes them from the low-code registry', () => {
    const material = fieldMaterial('Input')
    material.source = {
      configComponent: 'text',
      library: { packageName: 'element-plus', plugin: 'ElementPlus', stylesheet: 'element-plus/dist/index.css' },
      render: 'component',
      tag: 'el-input',
    }
    const registry = createDesignerRegistry([{ name: 'adapter', materials: [material] }])

    expect(createLowCodeComponentRegistry(registry).get('element.input')?.source).toEqual(material.source)

    material.source = { configComponent: 'text', render: 'component', tag: 'ElInput' }
    expect(() => createDesignerRegistry([{ name: 'invalid', materials: [material] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_SOURCE_BINDING_INVALID',
      }))
  })

  it('rejects malformed design policy values with a stable diagnostic', () => {
    const material = fieldMaterial('Unsafe input')
    material.designPolicy = { interaction: 'always' } as never
    expect(() => createDesignerRegistry([{ name: 'adapter', materials: [material] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_DESIGN_POLICY_INVALID',
      }))
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

  it('enforces structural material parent slots and validates registry references', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials: structuralMaterials() }])
    const item = registry.createNode('element.item', { id: 'item' })
    expect(analyzeDesignerDocument({ version: 1, form: {}, nodes: [item] }, registry)).toEqual([
      expect.objectContaining({ code: 'DESIGNER_MATERIAL_PARENT_INVALID', nodeId: 'item' }),
    ])

    const group = registry.createNode('element.group', { id: 'group' })
    if (group.kind !== 'container')
      throw new Error('Expected group container fixture')
    group.slots.default!.push(item)
    expect(analyzeDesignerDocument({ version: 1, form: {}, nodes: [group] }, registry)).toEqual([])

    const [, invalidItem] = structuralMaterials()
    invalidItem!.allowedParents = [{ material: 'element.missing', slot: 'default' }]
    expect(() => createDesignerRegistry([{ name: 'invalid', materials: [invalidItem!] }]))
      .toThrowError(expect.objectContaining<Partial<DesignerRegistryError>>({
        code: 'DESIGNER_MATERIAL_PARENT_INVALID',
      }))
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
