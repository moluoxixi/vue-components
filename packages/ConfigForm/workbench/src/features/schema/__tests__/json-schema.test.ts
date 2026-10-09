import { compileRules } from '@moluoxixi/zod3-to-rule'
import { describe, expect, it } from 'vitest'
import { previewJsonSchema } from '../services'

describe('offline JSON Schema ingestion', () => {
  it.each(['element-plus', 'antd-vue'] as const)(
    'maps %s fields and executable validation without losing defaults',
    (adapter) => {
      let id = 0
      const preview = previewJsonSchema(
        {
          type: 'object',
          required: ['email', 'count'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Work email' },
            count: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
            tier: { type: 'string', enum: ['A', 'B'], default: 'A' },
            enabled: { type: 'boolean', default: false },
            note: { type: ['string', 'null'], minLength: 2 },
          },
        },
        adapter,
        [],
        () => `field-${++id}`,
      )
      expect(preview.diagnostics).toEqual([])
      expect(preview.fields.map(field => field.component)).toEqual([
        adapter === 'element-plus' ? 'element.input' : 'antd.input',
        adapter === 'element-plus' ? 'element.input-number' : 'antd.input-number',
        adapter === 'element-plus' ? 'element.select' : 'antd.select',
        adapter === 'element-plus' ? 'element.switch' : 'antd.switch',
        adapter === 'element-plus' ? 'element.input' : 'antd.input',
      ])
      expect(preview.fields[0]).toMatchObject({ required: true, description: 'Work email' })
      expect(preview.fields[3]?.defaultValue).toBe(false)
      const email = compileRules(preview.fields[0]!.validation!).schema
      expect(email.safeParse('invalid').success).toBe(false)
      expect(email.safeParse('a@example.com').success).toBe(true)
      const count = compileRules(preview.fields[1]!.validation!).schema
      expect([0, 1.5, 6].every(value => !count.safeParse(value).success)).toBe(true)
      expect(count.safeParse(3).success).toBe(true)
      expect(compileRules(preview.fields[4]!.validation!).schema.safeParse(null).success).toBe(true)
    },
  )
  it('reports unsupported refs, nested shapes and conditional constraints instead of silently discarding them', () => {
    const preview = previewJsonSchema(
      {
        type: 'object',
        allOf: [],
        properties: {
          remote: { $ref: 'https://example.com/schema' },
          items: { type: 'array' },
          group: { type: 'object' },
        },
      },
      'element-plus',
    )
    expect(preview.fields).toEqual([])
    expect(preview.diagnostics.some(item => item.path === '$.allOf')).toBe(true)
    expect(preview.diagnostics.every(item => item.severity === 'error')).toBe(true)
  })
  it('blocks unsafe names, collisions, invalid regexes, defaults and keyword/type mismatches', () => {
    const preview = previewJsonSchema(
      JSON.parse(
        '{"type":"object","properties":{"constructor":{"type":"string"},"name":{"type":"string"},"pattern":{"type":"string","pattern":"["},"amount":{"type":"integer","default":1.5},"flag":{"type":"boolean","minimum":1}}}',
      ),
      'element-plus',
      ['name'],
    )
    expect(preview.fields).toEqual([])
    expect(preview.diagnostics).toHaveLength(5)
  })
  it('explains format limitations and verifies required references', () => {
    expect(
      previewJsonSchema(
        { type: 'object', properties: { name: { type: 'string', format: 'date-time' } } },
        'element-plus',
      ).diagnostics,
    ).toMatchObject([{ severity: 'warning' }])
    expect(
      previewJsonSchema({ type: 'object', required: ['missing'], properties: {} }, 'element-plus').diagnostics,
    ).toMatchObject([{ path: '$.required', severity: 'error' }])
  })
})
