import type {
  DesignerDocument,
  DesignerMaterialDefinition,
} from '../index'
import { describe, expect, it } from 'vitest'
import {
  compileDesignerDocument,
  createDesignerRegistry,
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
    },
    setters: [],
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
    setters: [],
    slots: [{ name: 'default', title: 'Content' }],
    createNode: ({ id }) => ({
      id,
      kind: 'container',
      material: 'element.section',
      slots: { default: [] },
    }),
  },
]

function createDocument(): DesignerDocument {
  return {
    version: 1,
    form: { readonly: true, columns: 3, gap: '12px', fieldSpan: 1, labelPosition: 'top' },
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
              conditions: {
                visible: {
                  kind: 'compare',
                  operator: 'eq',
                  left: { kind: 'field', field: 'enabled' },
                  right: { kind: 'literal', value: true },
                },
                required: { kind: 'literal', value: true },
              },
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
    })
    const section = compiled.fields[0]!
    expect(section).toMatchObject({ component: 'section', props: { title: 'Profile' } })
    const sectionSlots = section.slots
    expect(typeof sectionSlots).toBe('object')
    const field = Array.isArray(sectionSlots?.default) ? sectionSlots.default[0] : undefined
    expect(field).toMatchObject({
      component: 'input',
      field: 'email',
      requiredMessage: 'Email is required',
      valueProp: 'modelValue',
      trigger: 'update:modelValue',
    })
    if (!field || !('field' in field))
      return
    expect(typeof field.visible).toBe('function')
    expect(typeof field.required).toBe('function')
    expect((field.visible as (values: Record<string, unknown>) => boolean)({ enabled: true })).toBe(true)
    expect((field.visible as (values: Record<string, unknown>) => boolean)({ enabled: false })).toBe(false)
    expect(field.schema?.safeParse('bad').success).toBe(false)
    expect(field.schema?.safeParse('person@example.com').success).toBe(true)
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
