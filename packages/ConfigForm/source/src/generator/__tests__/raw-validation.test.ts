import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { RuleSet } from '@moluoxixi/zod3-to-rule'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { rawValidationModuleSource, rawValidatorNames } from '../services/raw-validation'
import { rawValidationComposableSource } from '../services/raw-validation-runtime'
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

async function generatedValidators(includeZod = false): Promise<{
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
  const source = rawValidationModuleSource(surface, plan.data.surfaces[0]!.fields, { includeZod })
  const root = await mkdtemp(join(packageRoot, '.raw-validation-'))
  temporaryRoots.push(root)
  const path = join(root, 'validation.ts')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, source)
  const generated = await import(`${pathToFileURL(path).href}?generated=${Date.now()}`) as Readonly<Record<string, unknown>>
  const validators = Object.fromEntries(
    [...rawValidatorNames(surface)].map(([nodeId, functionName]) => {
      const validator = generated[functionName]
      if (typeof validator !== 'function')
        throw new Error(`Generated validator ${functionName} is missing.`)
      return [nodeId, validator as GeneratedValidator]
    }),
  )
  return { source, validators }
}

interface GeneratedFormValidation {
  validationErrors: Record<string, string[]>
  validateFields: (fieldIds?: readonly string[], requireInstance?: boolean) => boolean
  validation: { validate: (request: { surfaceId: string, scope: 'surface' | 'fields', fieldIds: readonly string[] }) => boolean }
}

async function generatedFormValidation(surface: ProjectCompilation['ir']['surfacesById'][string], projected = false) {
  const plan = compileSourceValidationPlan({
    ir: { surfaceOrder: [surface.id], surfacesById: { [surface.id]: surface } },
  } as unknown as ProjectCompilation)
  if (!plan.success)
    throw new Error(plan.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  const root = await mkdtemp(join(packageRoot, '.raw-validation-'))
  temporaryRoots.push(root)
  const path = join(root, 'composables/useFormValidation.ts')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(join(root, 'validation.ts'), rawValidationModuleSource(surface, plan.data.surfaces[0]!.fields, { includeZod: true }))
  await writeFile(path, rawValidationComposableSource(surface, projected))
  return await import(pathToFileURL(path).href) as {
    useFormValidation: (
      values: Record<string, unknown>,
      states?: () => Readonly<Record<string, { required?: boolean }>>,
    ) => GeneratedFormValidation
  }
}

afterAll(async () => {
  await Promise.all(temporaryRoots.map(root => rm(root, { recursive: true, force: true })))
})

describe('generated Raw validators', () => {
  it('emits executable Zod schemas for Tailwind Raw output', async () => {
    const { source, validators } = await generatedValidators(true)
    expect(source).toContain('import { z } from \'zod\'')
    expect(source).toContain('export const stringRulesSchema')
    expect(source).toContain('export const dateSchema')
    expect(source).not.toContain('demoFieldValidators')
    expect(source).toContain('.safeParse(value)')
    expect(validators.stringRules!('ABC', {})).toEqual([])
    expect(validators.stringRules!('AB', {})).toContain('minLength')
    expect(validators.date!('2024-06-01T00:00:00.000Z', {})).toEqual([])
    expect(validators.date!('not-a-date', {})).toEqual(['Invalid date'])
  })

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

describe('generated page validation', () => {
  it('revalidates reactive business values and honors dynamic required state', async () => {
    const surface = {
      id: 'profile',
      nodesById: {
        name: field('name', ruleSet({ type: 'string' }, [{ kind: 'minLength', value: 2, message: 'Too short' }])),
        optionalNote: field('optionalNote'),
      },
      scopedFields: [],
      valueScopes: [],
      interactions: [{ kind: 'stateProjection', target: { kind: 'state', nodeId: 'optionalNote', key: 'required' } }],
    } as unknown as ProjectCompilation['ir']['surfacesById'][string]
    const { useFormValidation } = await generatedFormValidation(surface, true)
    const values = reactive({ name: 'A', optionalNote: '' })
    const states = reactive({ optionalNote: { required: true } })
    const result = useFormValidation(values, () => states)

    expect(result.validateFields(['name'])).toBe(false)
    expect(result.validationErrors.name).toEqual(['Too short'])
    values.name = 'Ada'
    expect(result.validateFields(['name'])).toBe(true)
    expect(result.validationErrors.name).toEqual([])
    expect(result.validateFields(['optionalNote'])).toBe(false)
    states.optionalNote.required = false
    expect(result.validateFields(['optionalNote'])).toBe(true)
    expect(result.validation.validate({ surfaceId: 'other', scope: 'surface', fieldIds: [] })).toBe(false)
    expect(result.validation.validate({ surfaceId: 'profile', scope: 'fields', fieldIds: [] })).toBe(false)
    expect(result.validateFields(['missing'])).toBe(false)
  })

  it('validates nested rows against their sibling values and rejects absent requested instances', async () => {
    const surface = {
      id: 'order',
      nodesById: {
        price: field('price', ruleSet({ type: 'number' }, [{ kind: 'compare', field: 'limit', operator: 'lte', message: 'Exceeds limit' }])),
        note: field('note'),
      },
      scopedFields: [{ nodeId: 'price', scopeId: 'rows' }, { nodeId: 'note', scopeId: 'rows' }],
      valueScopes: [
        { nodeId: 'details', kind: 'object', field: 'details' },
        { nodeId: 'rows', parentId: 'details', kind: 'array', field: 'items' },
      ],
      interactions: [],
    } as unknown as ProjectCompilation['ir']['surfacesById'][string]
    const { useFormValidation } = await generatedFormValidation(surface)
    const values = reactive({ details: { items: [{ price: 3, limit: 4 }, { price: 6, limit: 5 }] } })
    const result = useFormValidation(values)

    expect(result.validateFields(['price'])).toBe(false)
    expect(result.validationErrors.price).toEqual(['Exceeds limit'])
    values.details.items[1]!.price = 4
    expect(result.validateFields(['price'])).toBe(true)
    values.details.items = []
    expect(result.validation.validate({ surfaceId: 'order', scope: 'fields', fieldIds: ['price'] })).toBe(false)
    expect(result.validationErrors.price).toEqual(['No live field instance exists for price.'])
    expect(result.validation.validate({ surfaceId: 'order', scope: 'fields', fieldIds: ['note'] })).toBe(false)
    expect(result.validation.validate({ surfaceId: 'order', scope: 'surface', fieldIds: [] })).toBe(true)
    expect(result.validationErrors.price).toEqual([])
  })
})
