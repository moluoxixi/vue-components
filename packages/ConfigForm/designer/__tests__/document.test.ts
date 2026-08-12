import type { DesignerDocument } from '../index'
import { describe, expect, it } from 'vitest'
import {
  DESIGNER_DOCUMENT_VERSION,
  isDesignerJsonObject,
  isDesignerJsonValue,
  parseDesignerDocument,
} from '../index'

function createDocument(): DesignerDocument {
  return {
    version: DESIGNER_DOCUMENT_VERSION,
    form: { readonly: true, columns: 2, gap: '16px', labelPosition: 'left' },
    nodes: [
      {
        id: 'field-name',
        kind: 'field',
        material: 'element.input',
        field: 'name',
        label: 'Name',
        props: { clearable: true },
        extensions: {
          'designer.setter': { path: ['label'], inherited: false },
        },
        conditions: {
          visible: {
            kind: 'compare',
            operator: 'eq',
            left: { kind: 'field', field: 'enabled' },
            right: { kind: 'literal', value: true },
          },
        },
        validation: {
          version: 1,
          base: { type: 'string' },
          rules: [{ kind: 'required', message: 'Required' }],
        },
      },
      {
        id: 'field-enabled',
        kind: 'field',
        material: 'element.switch',
        field: 'enabled',
      },
    ],
  }
}

describe('designer document', () => {
  it('strictly parses a JSON round-trip', () => {
    const document = createDocument()
    const result = parseDesignerDocument(JSON.parse(JSON.stringify(document)))

    expect(result).toEqual({ success: true, data: document, diagnostics: [] })
  })

  it('rejects unsupported versions, unknown keys, and non-JSON values', () => {
    expect(parseDesignerDocument({ ...createDocument(), version: 2 })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DOCUMENT_VERSION_UNSUPPORTED', path: ['version'] }],
    })

    expect(parseDesignerDocument({ ...createDocument(), runtime: true })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DOCUMENT_INVALID' }],
    })

    const withFunction = createDocument() as unknown as Record<string, unknown>
    withFunction.form = { formatter: () => 'forbidden' }
    expect(parseDesignerDocument(withFunction).success).toBe(false)

    const withDate = createDocument()
    withDate.nodes[0]!.props = { date: new Date() as never }
    expect(parseDesignerDocument(withDate).success).toBe(false)

    const withExtensionDate = createDocument()
    withExtensionDate.nodes[0]!.extensions = { date: new Date() as never }
    expect(parseDesignerDocument(withExtensionDate).success).toBe(false)

    expect(parseDesignerDocument({
      ...createDocument(),
      form: { ...createDocument().form, labelPosition: 'inline' },
    }).success).toBe(false)
  })

  it('round-trips reactions and diagnoses duplicate ids and every field reference', () => {
    const document = createDocument()
    const name = document.nodes[0]
    const enabled = document.nodes[1]
    if (name?.kind !== 'field' || enabled?.kind !== 'field')
      throw new Error('Expected field fixtures')
    name.reactions = [{
      id: 'link-name',
      when: {
        kind: 'compare',
        operator: 'eq',
        left: { kind: 'field', field: 'enabled' },
        right: { kind: 'literal', value: true },
      },
      then: [
        { kind: 'setValue', target: 'name', value: { kind: 'field', field: 'enabled' } },
        { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'field', field: 'name' } } },
      ],
    }]
    expect(parseDesignerDocument(JSON.parse(JSON.stringify(document)))).toEqual({
      success: true,
      data: document,
      diagnostics: [],
    })

    enabled.reactions = [{
      id: 'link-name',
      when: {
        kind: 'compare',
        operator: 'eq',
        left: { kind: 'field', field: 'missing-condition' },
        right: { kind: 'literal', value: true },
      },
      then: [
        { kind: 'setValue', target: 'missing-target', value: { kind: 'field', field: 'missing-value' } },
        { kind: 'setProps', target: 'name', props: { placeholder: { kind: 'field', field: 'missing-prop' } } },
      ],
    }]
    expect(parseDesignerDocument(document)).toMatchObject({
      success: false,
      diagnostics: [
        { code: 'DESIGNER_REACTION_ID_DUPLICATE', path: ['nodes', 1, 'reactions', 0, 'id'], nodeId: 'field-enabled' },
        { code: 'DESIGNER_REACTION_FIELD_UNKNOWN', path: ['nodes', 1, 'reactions', 0, 'when', 'left', 'field'], nodeId: 'field-enabled' },
        { code: 'DESIGNER_REACTION_FIELD_UNKNOWN', path: ['nodes', 1, 'reactions', 0, 'then', 0, 'target'], nodeId: 'field-enabled' },
        { code: 'DESIGNER_REACTION_FIELD_UNKNOWN', path: ['nodes', 1, 'reactions', 0, 'then', 0, 'value', 'field'], nodeId: 'field-enabled' },
        { code: 'DESIGNER_REACTION_FIELD_UNKNOWN', path: ['nodes', 1, 'reactions', 0, 'then', 1, 'props', 'placeholder', 'field'], nodeId: 'field-enabled' },
      ],
    })
  })

  it('parses responsive overrides without changing numeric form settings', () => {
    const document = createDocument()
    document.form.responsive = {
      tablet: { columns: 12, fieldSpan: 6 },
      mobile: { columns: 4, fieldSpan: 4 },
    }

    expect(parseDesignerDocument(document)).toEqual({
      success: true,
      data: document,
      diagnostics: [],
    })
    expect(parseDesignerDocument({
      ...document,
      form: {
        ...document.form,
        responsive: { mobile: { columns: 25 } },
      },
    }).success).toBe(false)

    // Numeric documents from before the 24-cell designer remain importable;
    // runtime layout resolution clamps them at the rendering boundary.
    expect(parseDesignerDocument({
      ...document,
      form: { ...document.form, columns: 25, fieldSpan: 25 },
      nodes: [{ ...document.nodes[0]!, span: 25 }, document.nodes[1]!],
    }).success).toBe(true)
  })

  it('preserves imported nested spans even though only root nodes consume them', () => {
    const nested = {
      id: 'nested-name',
      kind: 'field' as const,
      material: 'element.input',
      field: 'nestedName',
      span: 24,
    }
    const document: DesignerDocument = {
      version: DESIGNER_DOCUMENT_VERSION,
      form: { columns: 24, fieldSpan: 8 },
      nodes: [{
        id: 'section',
        kind: 'container',
        material: 'element.section',
        span: 24,
        slots: { default: [nested] },
      }],
    }

    expect(parseDesignerDocument(JSON.parse(JSON.stringify(document)))).toEqual({
      success: true,
      data: document,
      diagnostics: [],
    })
  })

  it('reports duplicate node ids and field keys at the second occurrence', () => {
    const document = createDocument()
    document.nodes.push({
      id: 'field-name',
      kind: 'field',
      material: 'element.input',
      field: 'name',
    })

    expect(parseDesignerDocument(document)).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'DESIGNER_NODE_ID_DUPLICATE',
          path: ['nodes', 2, 'id'],
          nodeId: 'field-name',
        },
        {
          code: 'DESIGNER_FIELD_DUPLICATE',
          path: ['nodes', 2, 'field'],
          nodeId: 'field-name',
        },
      ],
    })
  })

  it('rejects condition and comparison-rule references to unknown fields', () => {
    const document = createDocument()
    const name = document.nodes[0]
    if (name?.kind !== 'field')
      throw new Error('Expected field fixture')
    name.conditions!.visible = {
      kind: 'compare',
      operator: 'eq',
      left: { kind: 'field', field: 'missing-condition' },
      right: { kind: 'literal', value: true },
    }
    name.validation!.rules.push({
      kind: 'compare',
      field: 'missing-rule',
      operator: 'eq',
    })

    expect(parseDesignerDocument(document)).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'DESIGNER_CONDITION_FIELD_UNKNOWN',
          path: ['nodes', 0, 'conditions', 'visible', 'left', 'field'],
          nodeId: 'field-name',
        },
        {
          code: 'DESIGNER_RULE_FIELD_UNKNOWN',
          path: ['nodes', 0, 'validation', 'rules', 1, 'field'],
          nodeId: 'field-name',
        },
      ],
    })
  })

  it('reports object reference cycles before recursive schema parsing', () => {
    const document = createDocument()
    const container = {
      id: 'section',
      kind: 'container' as const,
      material: 'element.section',
      slots: { default: [] as unknown[] },
    }
    container.slots.default.push(container)
    document.nodes = [container as never]

    expect(parseDesignerDocument(document)).toMatchObject({
      success: false,
      diagnostics: [{ code: 'DESIGNER_DOCUMENT_CYCLE' }],
    })
  })

  it('validates programmatic JSON values without accepting instances or cycles', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    expect(isDesignerJsonObject({ nested: [1, 'two', true, null] })).toBe(true)
    expect(isDesignerJsonValue([1, { valid: true }])).toBe(true)
    expect(isDesignerJsonObject(new Date())).toBe(false)
    expect(isDesignerJsonObject(cyclic)).toBe(false)
  })
})
