import type {
  DesignerDocument,
  DesignerFieldMaterialDefinition,
  DesignerMaterialDefinition,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  compileConfigModel,
  compileDesignerDocument,
  createConfigModelRuntimeProjection,
  createDesignerRegistry,
  createDesignerRuntimeProjection,
  createLowCodeComponentRegistry,
  designerDocumentToConfigModel,
} from '../index'

const materials: DesignerMaterialDefinition[] = [
  {
    key: 'element.input',
    version: 1,
    kind: 'field',
    title: 'Input',
    category: 'Fields',
    runtime: {
      component: 'input',
      valueProp: 'modelValue',
      trigger: 'update:modelValue',
      readonlyRender: ({ node, value }) => `${node.field}:${String(value ?? '')}`,
    },
    source: { configComponent: 'Input', tag: 'input', render: 'component' },
    setters: [{
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'text',
    }],
    createNode: ({ id, field = 'field' }) => ({
      id,
      kind: 'field',
      material: 'element.input',
      field,
    }),
  },
  {
    key: 'element.section',
    version: 1,
    kind: 'container',
    title: 'Section',
    category: 'Layout',
    runtime: { component: 'section' },
    source: { configComponent: 'Section', tag: 'section', render: 'component' },
    setters: [{
      key: 'title',
      label: 'Title',
      path: ['props', 'title'],
      control: 'text',
    }],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      slots: { default: [] },
    }),
  },
  {
    key: 'element.number',
    version: 1,
    kind: 'field',
    title: 'Number',
    category: 'Fields',
    runtime: { component: 'input' },
    source: { configComponent: 'NumberInput', tag: 'input', render: 'component' },
    setters: [{
      key: 'defaultValue',
      label: 'Default value',
      path: ['defaultValue'],
      control: 'defaultValue',
      valueKind: 'number',
    }],
    createNode: ({ id, field = 'number' }) => ({
      id,
      kind: 'field',
      material: 'element.number',
      field,
    }),
  },
]

function createDocument(): DesignerDocument {
  return {
    version: 1,
    form: {
      readonly: true,
      columns: 3,
      gap: '12px',
      fieldSpan: 1,
      labelPosition: 'top',
      responsive: {
        tablet: { columns: 2, fieldSpan: 1 },
        mobile: { columns: 1, fieldSpan: 1 },
      },
    },
    nodes: [
      {
        id: 'section',
        kind: 'container',
        material: 'element.section',
        props: { title: 'Profile' },
        slots: {
          default: [
            {
              id: 'email',
              kind: 'field',
              material: 'element.input',
              field: 'email',
              label: 'Email',
              events: { 'update:modelValue': [{ action: 'audit' }] },
              bindings: { value: { source: 'profile.email' } },
              extensions: { 'designer.setter': { path: ['label'], source: 'adapter' } },
              conditions: {
                visible: {
                  kind: 'compare',
                  operator: 'eq',
                  left: { kind: 'field', field: 'enabled' },
                  right: { kind: 'literal', value: true },
                },
                required: { kind: 'literal', value: true },
              },
              reactions: [{
                id: 'disable-email',
                when: { kind: 'literal', value: true },
                then: [{ kind: 'setState', target: 'email', state: { disabled: true } }],
              }],
              validation: {
                version: 1,
                base: { type: 'string' },
                rules: [
                  { kind: 'required', message: 'Email is required' },
                  { kind: 'email', message: 'Invalid email' },
                ],
              },
            },
          ],
        },
      },
      {
        id: 'enabled',
        kind: 'field',
        material: 'element.input',
        field: 'enabled',
      },
    ],
  }
}

describe('designer compiler', () => {
  it('uses controlled design adapters without activating legacy designer components', () => {
    const controlledAdapter = { name: 'ControlledAdapter' }
    const runtimeComponent = { name: 'RuntimeComponent' }
    const legacyDesignerComponent = { name: 'LegacyDesignerComponent' }
    const baseFieldMaterial = materials[0] as DesignerFieldMaterialDefinition
    const safeMaterial: DesignerFieldMaterialDefinition = {
      ...baseFieldMaterial,
      key: 'element.safe',
      runtime: { component: runtimeComponent, designerComponent: legacyDesignerComponent },
      createNode: ({ id, field = 'safe' }) => ({ id, kind: 'field', material: 'element.safe', field }),
    }
    const controlledMaterial: DesignerFieldMaterialDefinition = {
      ...baseFieldMaterial,
      key: 'element.controlled',
      runtime: { component: runtimeComponent },
      designPolicy: {
        async: 'adapter',
        adapter: controlledAdapter,
        visualEquivalence: 'runtime-geometry',
        diagnostic: 'Async component uses a deterministic editor adapter.',
      },
      createNode: ({ id, field = 'controlled' }) => ({ id, kind: 'field', material: 'element.controlled', field }),
    }
    const registry = createDesignerRegistry([{ name: 'adapter', materials: [safeMaterial, controlledMaterial] }])
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [
        registry.createNode('element.safe', { id: 'safe', field: 'safe' }),
        registry.createNode('element.controlled', { id: 'controlled', field: 'controlled' }),
      ],
    }

    const design = createDesignerRuntimeProjection(document, registry)
    expect(design.fields.map(node => node.component)).toEqual([runtimeComponent, controlledAdapter])

    const runtime = compileDesignerDocument(document, registry)
    expect(runtime.success).toBe(true)
    if (runtime.success)
      expect(runtime.fields.map(node => node.component)).toEqual([runtimeComponent, runtimeComponent])
  })

  it('compiles document nodes into the real renderer contract without mutating input', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials }])
    const document = createDocument()
    const snapshot = structuredClone(document)
    const compiled = compileDesignerDocument(document, registry)

    expect(compiled.success).toBe(true)
    expect(document).toEqual(snapshot)
    if (!compiled.success)
      return

    expect(compiled.renderer).toMatchObject({
      readonly: true,
      columns: 3,
      gap: '12px',
      fieldSpan: 1,
      labelPosition: 'top',
      responsive: {
        tablet: { columns: 2, fieldSpan: 1 },
        mobile: { columns: 1, fieldSpan: 1 },
      },
    })
    const section = compiled.fields[0]!
    expect(section).toMatchObject({ component: 'section', props: { title: 'Profile' } })
    const sectionSlots = section.slots
    expect(typeof sectionSlots).toBe('object')
    const field = Array.isArray(sectionSlots?.default) ? sectionSlots.default[0] : undefined
    expect(field).toMatchObject({
      component: 'input',
      extensions: {
        'designer.setter': { path: ['label'], source: 'adapter' },
        'mx.low-code': {
          events: { 'update:modelValue': [{ action: 'audit' }] },
          bindings: { value: { source: 'profile.email' } },
        },
      },
      field: 'email',
      requiredMessage: 'Email is required',
      valueProp: 'modelValue',
      trigger: 'update:modelValue',
    })
    if (!field || !('field' in field))
      return
    const sourceField = document.nodes[0]?.kind === 'container'
      ? document.nodes[0].slots.default?.[0]
      : undefined
    expect(field.extensions).not.toBe(sourceField?.extensions)
    expect(field.reactions).toEqual(sourceField?.reactions)
    expect(field.reactions).not.toBe(sourceField?.reactions)
    expect(field.reactions?.[0]).not.toBe(sourceField?.reactions?.[0])
    field.reactions![0]!.id = 'compiled-only'
    expect(sourceField?.reactions?.[0]?.id).toBe('disable-email')
    expect(typeof field.visible).toBe('function')
    expect(typeof field.required).toBe('function')
    expect((field.visible as (values: Record<string, unknown>) => boolean)({ enabled: true })).toBe(true)
    expect((field.visible as (values: Record<string, unknown>) => boolean)({ enabled: false })).toBe(false)
    expect(typeof field.readonlyRender).toBe('function')
    expect(field.readonlyRender?.({
      componentProps: { placeholder: 'Email' },
      field,
      model: { email: 'person@example.com' },
      value: 'person@example.com',
    })).toBe('email:person@example.com')
    expect(field.schema?.safeParse('bad').success).toBe(false)
    expect(field.schema?.safeParse('person@example.com').success).toBe(true)
  })

  it('compiles the canonical config model directly with runtime parity', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials }])
    const lowCodeRegistry = createLowCodeComponentRegistry(registry)
    const document = createDocument()
    const model = designerDocumentToConfigModel(document, { id: 'profile', name: 'Profile' })
    const modelSnapshot = structuredClone(model)
    const legacy = compileDesignerDocument(document, registry)
    const compiled = compileConfigModel(model, lowCodeRegistry)
    const designProjection = createConfigModelRuntimeProjection(model, lowCodeRegistry)
    const legacyDesignProjection = createDesignerRuntimeProjection(document, registry)

    expect(compiled.success, JSON.stringify(compiled.success ? [] : compiled.diagnostics)).toBe(true)
    expect(model).toEqual(modelSnapshot)
    expect(legacy.success).toBe(true)
    if (!compiled.success || !legacy.success)
      return
    expect(JSON.parse(JSON.stringify(compiled.fields))).toEqual(JSON.parse(JSON.stringify(legacy.fields)))
    expect(JSON.parse(JSON.stringify(compiled.renderer))).toEqual(JSON.parse(JSON.stringify(legacy.renderer)))
    expect(JSON.parse(JSON.stringify(designProjection))).toEqual(JSON.parse(JSON.stringify(legacyDesignProjection)))

    const invalid = structuredClone(model)
    invalid.nodes[0]!.component = 'element.missing'
    expect(compileConfigModel(invalid, lowCodeRegistry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'MODEL_COMPONENT_UNKNOWN', nodeId: 'section' }],
    })

    const invalidDefault = structuredClone(model)
    const section = invalidDefault.nodes[0]
    if (section?.kind !== 'container' || section.children[0]?.kind !== 'field')
      throw new Error('Expected nested field fixture')
    section.children[0].defaultValue = 42
    const invalidDefaultResult = compileConfigModel(invalidDefault, lowCodeRegistry)
    expect(invalidDefaultResult.success).toBe(false)
    expect(invalidDefaultResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MODEL_DEFAULT_KIND_INVALID', nodeId: 'email' }),
    ]))
  })

  it('does not return renderer fields when material or rule compilation fails', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials }])
    const unknown = createDocument()
    unknown.nodes[0]!.material = 'element.missing'
    const unknownResult = compileDesignerDocument(unknown, registry)
    expect(unknownResult).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_MATERIAL_UNKNOWN' }],
    })
    expect('fields' in unknownResult).toBe(false)

    const mismatched = createDocument()
    const section = mismatched.nodes[0]
    if (section?.kind === 'container') {
      const field = section.slots.default?.[0]
      if (field?.kind === 'field') {
        field.validation = {
          version: 1,
          base: { type: 'number' },
          rules: [{ kind: 'email' }],
        }
      }
    }
    const mismatchResult = compileDesignerDocument(mismatched, registry)
    expect(mismatchResult).toMatchObject({
      success: false,
      diagnostics: [{ code: 'RULE_TYPE_MISMATCH', nodeId: 'email' }],
    })
    expect('fields' in mismatchResult).toBe(false)
  })

  it('blocks invalid defaults while preserving nullable optional defaults', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials }])
    const invalidKind: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'name',
        kind: 'field',
        material: 'element.input',
        field: 'name',
        defaultValue: 42,
      }],
    }
    expect(compileDesignerDocument(invalidKind, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DEFAULT_KIND_INVALID', nodeId: 'name' }],
    })

    const invalidRule = createDocument()
    const section = invalidRule.nodes[0]
    if (section?.kind !== 'container')
      throw new Error('Expected container fixture')
    const email = section.slots.default?.[0]
    if (email?.kind !== 'field')
      throw new Error('Expected field fixture')
    email.defaultValue = 'not-an-email'
    expect(compileDesignerDocument(invalidRule, registry)).toMatchObject({
      success: false,
      diagnostics: [expect.objectContaining({ code: 'DESIGNER_DEFAULT_RULE_INVALID', nodeId: 'email' })],
    })

    const invalidMinimum: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'quantity',
        kind: 'field',
        material: 'element.number',
        field: 'quantity',
        defaultValue: 1,
        validation: {
          version: 1,
          base: { type: 'number' },
          rules: [{ kind: 'min', value: 2 }],
        },
      }],
    }
    expect(compileDesignerDocument(invalidMinimum, registry)).toMatchObject({
      success: false,
      diagnostics: [expect.objectContaining({ code: 'DESIGNER_DEFAULT_RULE_INVALID', nodeId: 'quantity' })],
    })

    const requiredNull: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'required',
        kind: 'field',
        material: 'element.input',
        field: 'required',
        defaultValue: null,
        conditions: { required: { kind: 'literal', value: true } },
      }],
    }
    expect(compileDesignerDocument(requiredNull, registry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DEFAULT_REQUIRED_NULL', nodeId: 'required' }],
    })

    const optionalNull = structuredClone(requiredNull)
    optionalNull.nodes[0]!.conditions = undefined
    if (optionalNull.nodes[0]?.kind !== 'field')
      throw new Error('Expected field fixture')
    optionalNull.nodes[0].validation = {
      version: 1,
      base: { type: 'string' },
      rules: [],
      nullable: true,
    }
    expect(compileDesignerDocument(optionalNull, registry).success).toBe(true)
  })

  it('does not compile conditions or comparison rules with unknown field references', () => {
    const registry = createDesignerRegistry([{ name: 'adapter', materials }])
    const document = createDocument()
    const section = document.nodes[0]
    if (section?.kind !== 'container')
      throw new Error('Expected container fixture')
    const field = section.slots.default?.[0]
    if (field?.kind !== 'field')
      throw new Error('Expected field fixture')
    field.conditions!.visible = {
      kind: 'compare',
      operator: 'eq',
      left: { kind: 'field', field: 'missing-condition' },
      right: { kind: 'literal', value: true },
    }
    field.validation!.rules.push({
      kind: 'compare',
      field: 'missing-rule',
      operator: 'eq',
    })

    expect(compileDesignerDocument(document, registry)).toMatchObject({
      success: false,
      diagnostics: [
        { code: 'DESIGNER_CONDITION_FIELD_UNKNOWN', nodeId: 'email' },
        { code: 'DESIGNER_RULE_FIELD_UNKNOWN', nodeId: 'email' },
      ],
    })
  })

  it('resolves custom validators by registry key and reports missing keys', async () => {
    const document: DesignerDocument = {
      version: 1,
      form: {},
      nodes: [{
        id: 'name',
        kind: 'field',
        material: 'element.input',
        field: 'name',
        validation: {
          version: 1,
          base: { type: 'string' },
          rules: [{ kind: 'custom', key: 'reserved', params: ['root'] }],
        },
      }],
    }
    const missingRegistry = createDesignerRegistry([{ name: 'adapter', materials }])
    expect(compileDesignerDocument(document, missingRegistry)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'RULE_CUSTOM_VALIDATOR_MISSING', nodeId: 'name' }],
    })

    const registry = createDesignerRegistry([{
      name: 'local',
      materials,
      validators: {
        reserved: (value, _values, params) => (params as string[]).includes(String(value))
          ? 'Reserved name'
          : undefined,
      },
    }])
    const compiled = compileDesignerDocument(document, registry)
    expect(compiled.success).toBe(true)
    if (!compiled.success)
      return
    const field = compiled.fields[0]
    if (!field || !('field' in field))
      return
    await expect(field.validator?.('root', {})).resolves.toEqual(['Reserved name'])
  })
})
