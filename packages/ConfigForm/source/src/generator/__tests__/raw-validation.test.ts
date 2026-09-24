import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { rawValidationModuleSource } from '../services/raw-validation'
import { compileSourceValidationPlan } from '../services/validation'

type GeneratedValidator = (
  value: unknown,
  values: Readonly<Record<string, unknown>>,
  required?: boolean,
) => string[]

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url))
const temporaryRoots: string[] = []

function field(
  id: string,
  validation?: RuleSet,
  required?: { value: boolean, message: string },
): Record<string, unknown> {
  return {
    id,
    kind: 'field',
    field: id,
    label: id,
    validateOn: ['change', 'blur', 'submit'],
    ...(validation ? { validation } : {}),
    ...(required ? { required: required.value, requiredMessage: required.message } : {}),
  }
}

function ruleSet(base: RuleSet['base'], rules: RuleSet['rules'], options: {
  nullable?: boolean
  optional?: boolean
} = {}): RuleSet {
  return { version: 2, base, rules, ...options }
}

async function generatedValidators(): Promise<{
  source: string
  validators: Readonly<Record<string, GeneratedValidator>>
}> {
  const nodesById = {
    requiredOnly: field('requiredOnly', undefined, { value: true, message: 'Required override message' }),
    stringRules: field('stringRules', ruleSet({ type: 'string' }, [
      { kind: 'minLength', value: 3, message: 'minLength' },
      { kind: 'maxLength', value: 5, message: 'maxLength' },
      { kind: 'regex', source: '^[A-Z]+$', message: 'regex' },
    ])),
    exactLength: field('exactLength', ruleSet({ type: 'string' }, [
      { kind: 'length', value: 3, message: 'length' },
    ])),
    email: field('email', ruleSet({ type: 'string' }, [{ kind: 'email', message: 'email' }])),
    url: field('url', ruleSet({ type: 'string' }, [{ kind: 'url', message: 'url' }])),
    uuid: field('uuid', ruleSet({ type: 'string' }, [{ kind: 'uuid', message: 'uuid' }])),
    numberRules: field('numberRules', ruleSet({ type: 'number' }, [
      { kind: 'min', value: 0, inclusive: false, message: 'min' },
      { kind: 'max', value: 10, inclusive: false, message: 'max' },
      { kind: 'integer', message: 'integer' },
      { kind: 'finite', message: 'finite' },
    ])),
    decimal: field('decimal', ruleSet({ type: 'number' }, [
      { kind: 'multipleOf', value: 0.1, message: 'multipleOf' },
    ])),
    boolean: field('boolean', ruleSet({ type: 'boolean' }, [])),
    date: field('date', ruleSet({ type: 'date' }, [
      { kind: 'dateMin', value: '2024-01-01T00:00:00.000Z', message: 'dateMin' },
      { kind: 'dateMax', value: '2024-12-31T23:59:59.999Z', message: 'dateMax' },
    ])),
    enum: field('enum', ruleSet({ type: 'enum', values: ['draft', 'done'] }, [])),
    literal: field('literal', ruleSet({ type: 'literal', value: null }, [])),
    optional: field('optional', ruleSet({ type: 'string' }, [], { optional: true })),
    nullable: field('nullable', ruleSet({ type: 'string' }, [], { nullable: true })),
    compareEq: field('compareEq', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'eq', message: 'eq' }])),
    compareNeq: field('compareNeq', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'neq', message: 'neq' }])),
    compareGt: field('compareGt', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'gt', message: 'gt' }])),
    compareGte: field('compareGte', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'gte', message: 'gte' }])),
    compareLt: field('compareLt', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'lt', message: 'lt' }])),
    compareLte: field('compareLte', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'other', operator: 'lte', message: 'lte' }])),
    compareDate: field('compareDate', ruleSet({ type: 'date' }, [{ kind: 'compare', field: 'other', operator: 'gte', message: 'dateCompare' }])),
  }
  const surface = { id: 'home', nodesById } as unknown as ProjectCompilation['ir']['surfacesById'][string]
  const compilation = {
    ir: { surfaceOrder: ['home'], surfacesById: { home: surface } },
  } as unknown as ProjectCompilation
  const plan = compileSourceValidationPlan(compilation)
  if (!plan.success)
    throw new Error(plan.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  const source = rawValidationModuleSource(surface, plan.data.surfaces[0]!.fields)
  const root = await mkdtemp(join(packageRoot, '.raw-validation-'))
  temporaryRoots.push(root)
  const path = join(root, 'validation.ts')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, source)
  const generated = await import(`${pathToFileURL(path).href}?generated=${Date.now()}`) as {
    demoFieldValidators: Readonly<Record<string, GeneratedValidator>>
  }
  return { source, validators: generated.demoFieldValidators }
}

afterAll(async () => {
  await Promise.all(temporaryRoots.map(root => rm(root, { recursive: true, force: true })))
})

describe('generated Raw validators', () => {
  it('executes field-level Required and every serializable base', async () => {
    const { validators } = await generatedValidators()
    const validate = (id: string, value: unknown, values: Record<string, unknown> = {}, required?: boolean) => (
      validators[id]!(value, values, required)
    )

    expect(validate('requiredOnly', '   ')).toEqual(['Required override message'])
    expect(validate('requiredOnly', undefined, {}, false)).toEqual([])
    expect(validate('stringRules', 'ABC')).toEqual([])
    expect(validate('stringRules', 3)).not.toEqual([])
    expect(validate('boolean', false)).toEqual([])
    expect(validate('boolean', 'false')).not.toEqual([])
    expect(validate('date', '2024-06-01T00:00:00.000Z')).toEqual([])
    expect(validate('date', 'not-a-date')).not.toEqual([])
    expect(validate('enum', 'done')).toEqual([])
    expect(validate('enum', 'missing')).not.toEqual([])
    expect(validate('literal', null)).toEqual([])
    expect(validate('literal', 'null')).not.toEqual([])
    expect(validate('optional', undefined)).toEqual([])
    expect(validate('optional', null)).not.toEqual([])
    expect(validate('nullable', null)).toEqual([])
    expect(validate('nullable', undefined)).not.toEqual([])
  })

  it('executes every built-in direct rule and decimal-scaled multipleOf', async () => {
    const { source, validators } = await generatedValidators()
    const validate = (id: string, value: unknown, values: Record<string, unknown> = {}) => (
      validators[id]!(value, values)
    )

    expect(validate('stringRules', 'AB')).toContain('minLength')
    expect(validate('stringRules', 'ABCDEF')).toContain('maxLength')
    expect(validate('stringRules', 'Abc')).toContain('regex')
    expect(validate('exactLength', 'AB')).toContain('length')
    expect(validate('email', 'designer@example.com')).toEqual([])
    expect(validate('email', 'designer+tag@example.co.uk')).toEqual([])
    expect(validate('email', 'designer@')).toContain('email')
    expect(validate('email', '.designer@example.com')).toContain('email')
    expect(validate('email', 'designer..name@example.com')).toContain('email')
    expect(validate('email', 'a@b.c')).toContain('email')
    expect(validate('url', 'https://example.com/demo')).toEqual([])
    expect(validate('url', 'not a url')).toContain('url')
    expect(validate('uuid', '123e4567-e89b-42d3-a456-426614174000')).toEqual([])
    expect(validate('uuid', '00000000-0000-0000-0000-000000000000')).toEqual([])
    expect(validate('uuid', 'ffffffff-ffff-ffff-ffff-ffffffffffff')).toEqual([])
    expect(validate('uuid', 'bad')).toContain('uuid')
    expect(validate('numberRules', 0)).toContain('min')
    expect(validate('numberRules', 10)).toContain('max')
    expect(validate('numberRules', 1.5)).toContain('integer')
    expect(validate('numberRules', Number.POSITIVE_INFINITY)).toContain('finite')
    expect(validate('decimal', 0.3)).toEqual([])
    expect(validate('decimal', 0.31)).toContain('multipleOf')
    expect(validate('date', '2023-12-31T00:00:00.000Z')).toContain('dateMin')
    expect(validate('date', '2025-01-01T00:00:00.000Z')).toContain('dateMax')
    expect(source).toContain('scaledLeft % scaledRight === 0n')
    expect(source).not.toMatch(/compileRules|RuleSet|@moluoxixi|\bzod\b/)
  })

  it.each([
    ['compareEq', 2, 2, 3, 'eq'],
    ['compareNeq', 2, 3, 2, 'neq'],
    ['compareGt', 3, 2, 3, 'gt'],
    ['compareGte', 2, 2, 3, 'gte'],
    ['compareLt', 2, 3, 2, 'lt'],
    ['compareLte', 2, 2, 1, 'lte'],
  ])('executes %s compare semantics', async (id, value, passingOther, failingOther, message) => {
    const { validators } = await generatedValidators()
    expect(validators[id]!(value, { other: passingOther })).toEqual([])
    expect(validators[id]!(value, { other: failingOther })).toContain(message)
  })

  it('compares normalized date values', async () => {
    const { validators } = await generatedValidators()
    expect(validators.compareDate!('2024-06-01T00:00:00.000Z', {
      other: '2024-01-01T00:00:00.000Z',
    })).toEqual([])
    expect(validators.compareDate!('2023-01-01T00:00:00.000Z', {
      other: '2024-01-01T00:00:00.000Z',
    })).toContain('dateCompare')
  })
})
