import type { DesignerDocument } from '../index'
import { describe, expect, it } from 'vitest'
import {
  DESIGNER_DOCUMENT_VERSION,
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

    expect(parseDesignerDocument({
      ...createDocument(),
      form: { ...createDocument().form, labelPosition: 'inline' },
    }).success).toBe(false)
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
})
