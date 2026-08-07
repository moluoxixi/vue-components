import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  compileRules,
  parseRuleSet,
  RuleCompileError,
  rulesToZod,
  zodToRules,
} from '../index'

describe('zod3-to-rule', () => {
  it('parses JSON-safe rule sets and rejects unknown keys', () => {
    const result = parseRuleSet({
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'minLength', value: 2 }],
    })

    expect(result).toEqual({
      success: true,
      data: {
        version: 1,
        base: { type: 'string' },
        rules: [{ kind: 'minLength', value: 2 }],
      },
      diagnostics: [],
    })

    expect(parseRuleSet({
      version: 1,
      base: { type: 'string' },
      rules: [],
      runtime: () => undefined,
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'RULE_DOCUMENT_INVALID' }],
    })

    expect(parseRuleSet({
      version: 1,
      base: { type: 'string', runtime: 'forbidden' },
      rules: [],
    }).success).toBe(false)

    expect(parseRuleSet({
      version: 1,
      base: { type: 'number' },
      rules: [{ kind: 'min', value: Number.POSITIVE_INFINITY }],
    }).success).toBe(false)

    expect(parseRuleSet({
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'email', runtime: 'forbidden' }],
    }).success).toBe(false)

    expect(parseRuleSet({
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'regex', source: '[', flags: 'gg' }],
    }).success).toBe(false)
  })

  it('round-trips parsed rules through JSON without changing the contract', () => {
    const input = {
      version: 1,
      base: { type: 'number' },
      rules: [
        { kind: 'min', value: 1, inclusive: false, message: '必须大于 1' },
        { kind: 'custom', key: 'available', params: { scope: ['team', 2] } },
      ],
      nullable: true,
    }

    const parsed = parseRuleSet(JSON.parse(JSON.stringify(input)))
    expect(parsed).toMatchObject({ success: true, data: input })
  })

  it('compiles local rules to Zod and keeps required metadata', () => {
    const ruleSet = {
      version: 1 as const,
      base: { type: 'string' as const },
      rules: [
        { kind: 'required' as const, message: '请输入名称' },
        { kind: 'minLength' as const, value: 2 },
        { kind: 'email' as const },
      ],
    }
    const compiled = compileRules(ruleSet)

    expect(compiled.required).toBe(true)
    expect(compiled.requiredMessage).toBe('请输入名称')
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.schema.safeParse('a').success).toBe(false)
    expect(compiled.schema.safeParse('  ').success).toBe(false)
    expect(compiled.schema.safeParse('person@example.com').success).toBe(true)
    expect(rulesToZod(ruleSet).safeParse('bad').success).toBe(false)
  })

  it('preserves exclusive number bounds in both conversion directions', () => {
    const schema = rulesToZod({
      version: 1,
      base: { type: 'number' },
      rules: [
        { kind: 'min', value: 1, inclusive: false },
        { kind: 'max', value: 3, inclusive: false },
      ],
    })

    expect(schema.safeParse(1).success).toBe(false)
    expect(schema.safeParse(2).success).toBe(true)
    expect(schema.safeParse(3).success).toBe(false)
    expect(zodToRules(z.number().gt(1).lt(3)).ruleSet?.rules).toEqual([
      { kind: 'min', value: 1, inclusive: false },
      { kind: 'max', value: 3, inclusive: false },
    ])
  })

  it('wraps invalid regular expressions in RuleCompileError', () => {
    expect(() => rulesToZod({
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'regex', source: '[', flags: 'gg' }],
    })).toThrowError(RuleCompileError)

    expect(() => rulesToZod({
      version: 1,
      base: { type: 'date' },
      rules: [{ kind: 'dateMin', value: 'not-a-date' }],
    })).toThrowError(RuleCompileError)
  })

  it('compiles cross-field comparisons through the runtime validator boundary', async () => {
    const compiled = compileRules({
      version: 1,
      base: { type: 'number' },
      rules: [{ kind: 'compare', field: 'start', operator: 'gte', message: '结束时间不合法' }],
    })

    await expect(compiled.validator?.(2, { start: 3 })).resolves.toEqual(['结束时间不合法'])
    await expect(compiled.validator?.(3, { start: 2 })).resolves.toEqual([])
  })

  it('resolves named custom validators and reports missing registrations', async () => {
    const ruleSet = {
      version: 1 as const,
      base: { type: 'string' as const },
      rules: [{ kind: 'custom' as const, key: 'reserved', params: { names: ['root'] } }],
    }
    const missing = compileRules(ruleSet)
    expect(missing.diagnostics).toEqual([
      expect.objectContaining({
        code: 'RULE_CUSTOM_VALIDATOR_MISSING',
        path: ['rules', 0],
      }),
    ])

    const compiled = compileRules(ruleSet, {
      custom: {
        reserved: (value, _values, params) => {
          const names = (params as { names: string[] }).names
          return names.includes(String(value)) ? '名称已保留' : undefined
        },
      },
    })
    await expect(compiled.validator?.('root', {})).resolves.toEqual(['名称已保留'])
    await expect(compiled.validator?.('user', {})).resolves.toEqual([])
  })

  it('reports an optional and required conflict', () => {
    const compiled = compileRules({
      version: 1,
      base: { type: 'string' },
      rules: [{ kind: 'required' }],
      optional: true,
    })

    expect(compiled.diagnostics).toEqual([
      expect.objectContaining({ code: 'RULE_OPTIONAL_REQUIRED_CONFLICT' }),
    ])
  })

  it('exports supported Zod checks and preserves optional/nullable wrappers', () => {
    const exported = zodToRules(z.string().min(2, '太短').email().optional().nullable())

    expect(exported.diagnostics).toEqual([])
    expect(exported.ruleSet).toEqual({
      version: 1,
      base: { type: 'string' },
      rules: [
        { kind: 'minLength', value: 2, message: '太短' },
        { kind: 'email' },
      ],
      optional: true,
      nullable: true,
    })
  })

  it('unwraps optional, nullable, and default wrappers in any order', () => {
    const exported = zodToRules(z.string().nullable().optional().default('fallback').nullable())

    expect(exported.ruleSet).toMatchObject({
      base: { type: 'string' },
      optional: true,
      nullable: true,
    })
    expect(exported.diagnostics).toEqual([
      expect.objectContaining({
        code: 'ZOD_UNSUPPORTED',
        message: expect.stringContaining('default'),
      }),
    ])
  })

  it('exports Zod date bounds stored as timestamps', () => {
    const min = new Date('2026-01-02T00:00:00.000Z')
    const max = new Date('2026-12-31T00:00:00.000Z')

    expect(zodToRules(z.date().min(min).max(max))).toEqual({
      ruleSet: {
        version: 1,
        base: { type: 'date' },
        rules: [
          { kind: 'dateMin', value: min.toISOString() },
          { kind: 'dateMax', value: max.toISOString() },
        ],
      },
      diagnostics: [],
    })
  })

  it('reports unsupported Zod effects instead of pretending to round-trip them', () => {
    const exported = zodToRules(z.string().refine(value => value.length > 1, '自定义'))

    expect(exported.ruleSet).toBeUndefined()
    expect(exported.diagnostics).toEqual([
      expect.objectContaining({
        code: 'ZOD_UNSUPPORTED',
        severity: 'warning',
      }),
    ])
  })

  it('reports Zod coercion instead of dropping its input semantics', () => {
    const exported = zodToRules(z.coerce.number())

    expect(exported.ruleSet).toBeUndefined()
    expect(exported.diagnostics).toEqual([
      expect.objectContaining({
        code: 'ZOD_UNSUPPORTED',
        message: expect.stringContaining('coercion'),
      }),
    ])
  })
})
