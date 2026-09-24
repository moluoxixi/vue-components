import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import { compileRules } from '@moluoxixi/zod3-to-rule'
import { describe, expect, it } from 'vitest'
import { compileSourceValidationPlan } from '../services/validation'

function field(id: string, validation?: RuleSet): Record<string, unknown> {
  return {
    id,
    kind: 'field',
    field: id,
    ...(validation ? { validation } : {}),
  }
}

function compilation(nodesById: Record<string, Record<string, unknown>>): ProjectCompilation {
  return {
    ir: {
      surfaceOrder: ['home'],
      surfacesById: {
        home: {
          id: 'home',
          nodesById,
        },
      },
    },
  } as unknown as ProjectCompilation
}

describe('compileSourceValidationPlan', () => {
  it('returns stable current RuleSet metadata for binding and direct Raw emission', async () => {
    const result = compileSourceValidationPlan(compilation({
      second: field('second', {
        version: 2,
        base: { type: 'number' },
        rules: [{ kind: 'compare', field: 'first', operator: 'gte', message: 'Must follow first' }],
      }),
      first: field('first', {
        version: 2,
        base: { type: 'string' },
        rules: [
          { kind: 'minLength', value: 3 },
          { kind: 'regex', source: '^[a-z]+$', flags: 'i' },
        ],
      }),
      plain: field('plain'),
    }))

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.surfaces).toHaveLength(1)
    expect(result.data.surfaces[0]?.fields.map(item => item.nodeId)).toEqual(['first', 'second'])
    expect(result.data.surfaces[0]?.fields[0]).toMatchObject({
      nodeId: 'first',
      attachValidator: false,
    })
    expect(result.data.surfaces[0]?.fields[1]).toMatchObject({
      nodeId: 'second',
      attachValidator: true,
    })
    expect(JSON.parse(JSON.stringify(result.data))).toEqual(result.data)

    const first = compileRules(result.data.surfaces[0]!.fields[0]!.ruleSet)
    expect(first.schema.safeParse('ab').success).toBe(false)
    expect(first.schema.safeParse('Alpha').success).toBe(true)
    const second = compileRules(result.data.surfaces[0]!.fields[1]!.ruleSet)
    await expect(second.validator?.(2, { first: 3 })).resolves.toEqual(['Must follow first'])
    await expect(second.validator?.(4, { first: 3 })).resolves.toEqual([])
  })

  it('fails closed on the removed Required rule and legacy RuleSet version', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 1,
        base: { type: 'string' },
        rules: [{ kind: 'required' }],
      } as unknown as RuleSet),
    }))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.diagnostics).toHaveLength(2)
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: expect.arrayContaining(['version']) }),
        expect.objectContaining({ path: expect.arrayContaining(['kind']) }),
      ]))
      expect(result.diagnostics.every(diagnostic => (
        diagnostic.code === 'source_input_invalid'
        && diagnostic.nodeId === 'name'
        && diagnostic.surfaceId === 'home'
        && diagnostic.context?.reason === 'rule_parse_error'
      ))).toBe(true)
    }
  })

  it('fails closed when strict parsing rejects an invalid regex', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 2,
        base: { type: 'string' },
        rules: [{ kind: 'regex', source: '[' }],
      }),
    }))

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'source_input_invalid',
        nodeId: 'name',
        surfaceId: 'home',
        context: {
          reason: 'rule_parse_error',
          ruleDiagnostic: { severity: 'error' },
        },
      }],
    })
  })

  it('fails closed without data when strict parsing rejects an unknown rule kind', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 2,
        base: { type: 'string' },
        rules: [{ kind: 'futureRule' }],
      } as unknown as RuleSet),
    }))

    expect(result.success).toBe(false)
    expect('data' in result).toBe(false)
    if (!result.success) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: 'source_input_invalid',
          nodeId: 'name',
          surfaceId: 'home',
          path: expect.arrayContaining(['rules', 0, 'kind']),
          context: expect.objectContaining({ reason: 'rule_parse_error' }),
        }),
      ])
    }
  })

  it.each([
    ['dateMin', 'not-a-date'],
    ['dateMax', '2024-01-01'],
  ])('fails closed without data when %s has an invalid date', (kind, value) => {
    const result = compileSourceValidationPlan(compilation({
      date: field('date', {
        version: 2,
        base: { type: 'date' },
        rules: [{ kind, value }],
      } as unknown as RuleSet),
    }))

    expect(result.success).toBe(false)
    expect('data' in result).toBe(false)
    if (!result.success) {
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: 'source_input_invalid',
          nodeId: 'date',
          surfaceId: 'home',
          path: expect.arrayContaining(['rules', 0, 'value']),
          context: expect.objectContaining({ reason: 'rule_parse_error' }),
        }),
      ])
    }
  })

  it('fails closed when a rule is incompatible with its base type', () => {
    const result = compileSourceValidationPlan(compilation({
      enabled: field('enabled', {
        version: 2,
        base: { type: 'boolean' },
        rules: [{ kind: 'minLength', value: 1 }],
      }),
    }))

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'source_input_invalid',
        nodeId: 'enabled',
        surfaceId: 'home',
        context: {
          reason: 'rule_compile_error',
          ruleDiagnostic: { code: 'RULE_TYPE_MISMATCH', severity: 'error' },
        },
      }],
    })
  })

  it('fails closed when a custom validator has no source implementation', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 2,
        base: { type: 'string' },
        rules: [{ kind: 'custom', key: 'available' }],
      }),
    }))

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'source_input_invalid',
        path: ['ir', 'surfacesById', 'home', 'nodesById', 'name', 'validation', 'rules', 0],
        context: {
          reason: 'rule_diagnostic',
          ruleDiagnostic: { code: 'RULE_CUSTOM_VALIDATOR_MISSING', severity: 'error' },
        },
      }],
    })
  })

  it('does not return a partial plan when one field fails', () => {
    const result = compileSourceValidationPlan(compilation({
      valid: field('valid', {
        version: 2,
        base: { type: 'number' },
        rules: [{ kind: 'min', value: 1 }],
      }),
      invalid: field('invalid', {
        version: 2,
        base: { type: 'string' },
        rules: [{ kind: 'custom', key: 'missing' }],
      }),
    }))

    expect(result.success).toBe(false)
    expect('data' in result).toBe(false)
  })

  it('keeps surfaces with no validation fields explicit', () => {
    const result = compileSourceValidationPlan(compilation({ plain: field('plain') }))

    expect(result).toEqual({
      success: true,
      data: {
        surfaces: [{ surfaceId: 'home', fields: [] }],
      },
      diagnostics: [],
    })
  })
})
