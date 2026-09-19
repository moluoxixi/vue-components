import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import { compileRules } from '@moluoxixi/zod3-to-rule'
import { describe, expect, it } from 'vitest'
import {
  compileSourceValidationPlan,
  SOURCE_VALIDATION_RUNTIME_COMPILER,
} from '../services/validation'

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
  it('returns stable JSON-safe RuleSet metadata for runtime compileRules emission', async () => {
    const result = compileSourceValidationPlan(compilation({
      second: field('second', {
        version: 1,
        base: { type: 'number' },
        rules: [{ kind: 'compare', field: 'first', operator: 'gte', message: 'Must follow first' }],
      }),
      first: field('first', {
        version: 1,
        base: { type: 'string' },
        rules: [
          { kind: 'required', message: 'Name is required' },
          { kind: 'minLength', value: 3 },
          { kind: 'regex', source: '^[a-z]+$', flags: 'i' },
        ],
      }),
      plain: field('plain'),
    }))

    expect(result.success).toBe(true)
    if (!result.success)
      return
    expect(result.data.runtimeCompiler).toEqual(SOURCE_VALIDATION_RUNTIME_COMPILER)
    expect(result.data.surfaces).toHaveLength(1)
    expect(result.data.surfaces[0]?.fields.map(item => item.nodeId)).toEqual(['first', 'second'])
    expect(result.data.surfaces[0]?.fields[0]?.field).toEqual({
      attachSchema: true,
      attachValidator: false,
      required: true,
      requiredMessage: 'Name is required',
    })
    expect(result.data.surfaces[0]?.fields[1]?.field).toEqual({
      attachSchema: true,
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

  it('fails closed when compileRules returns an error diagnostic', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 1,
        base: { type: 'string' },
        rules: [{ kind: 'required' }],
        optional: true,
      }),
    }))

    expect(result).toMatchObject({
      success: false,
      diagnostics: [{
        code: 'source_input_invalid',
        nodeId: 'name',
        surfaceId: 'home',
        context: {
          reason: 'rule_diagnostic',
          ruleDiagnostic: { code: 'RULE_OPTIONAL_REQUIRED_CONFLICT', severity: 'error' },
        },
      }],
    })
  })

  it('fails closed when compileRules throws RuleCompileError', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 1,
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
          reason: 'rule_compile_error',
          ruleDiagnostic: { severity: 'error' },
        },
      }],
    })
  })

  it('fails closed when a custom validator has no source implementation', () => {
    const result = compileSourceValidationPlan(compilation({
      name: field('name', {
        version: 1,
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
        version: 1,
        base: { type: 'number' },
        rules: [{ kind: 'min', value: 1 }],
      }),
      invalid: field('invalid', {
        version: 1,
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
        runtimeCompiler: SOURCE_VALIDATION_RUNTIME_COMPILER,
        surfaces: [{ surfaceId: 'home', fields: [] }],
      },
      diagnostics: [],
    })
  })
})
