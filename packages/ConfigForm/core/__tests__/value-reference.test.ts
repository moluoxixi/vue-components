import type { ConfigFormValueInput, ConfigFormValueReferenceRemap } from '../src/value-reference'
import { describe, expect, it, vi } from 'vitest'
import {
  collectConfigFormValueReferences,
  ConfigFormValueReferenceError,
  remapConfigFormValueReferences,
  resolveConfigFormValueInput,
} from '../src/value-reference'

function invalidInput(value: unknown): ConfigFormValueInput {
  return value as ConfigFormValueInput
}

function readValueError(run: () => unknown): ConfigFormValueReferenceError {
  try {
    run()
  }
  catch (error) {
    expect(error).toBeInstanceOf(ConfigFormValueReferenceError)
    return error as ConfigFormValueReferenceError
  }
  throw new Error('Expected ConfigFormValueReferenceError.')
}

describe('config form value references', () => {
  it('resolves recursive inputs, scoped fields, Data payload paths, and preserves null', () => {
    const resolveField = vi.fn((id: string, scope: string) => (
      id === 'title' && scope === 'parent'
        ? { found: true, value: { text: 'Parent' } }
        : { found: false }
    ))
    const input: ConfigFormValueInput = {
      title: { $ref: { kind: 'field', nodeId: 'title', scope: 'parent' } },
      variable: { $ref: { kind: 'variable', variableId: 'nullable' } },
      eventId: { $ref: { kind: 'event', path: ['items', '0', 'id'] } },
      values: [false, 0, '', null],
    }

    const resolved = resolveConfigFormValueInput(input, {
      event: { items: [{ id: 7 }] },
      resolveField,
      variables: { nullable: null },
    })

    expect(resolved).toEqual({
      title: { text: 'Parent' },
      variable: null,
      eventId: 7,
      values: [false, 0, '', null],
    })
    expect(resolveField).toHaveBeenCalledWith('title', 'parent')
  })

  it('uses own-property presence rather than truthiness and reports missing references at the wrapper path', () => {
    expect(resolveConfigFormValueInput(
      { $ref: { kind: 'field', nodeId: 'zero' } },
      { fields: { empty: '', false: false, nil: null, zero: 0 } },
    )).toBe(0)
    expect(resolveConfigFormValueInput(
      { $ref: { kind: 'variable', variableId: 'nil' } },
      { variables: { nil: null } },
    )).toBeNull()

    const error = readValueError(() => resolveConfigFormValueInput({
      nested: { $ref: { kind: 'variable', variableId: 'missing' } },
    }, { variables: Object.create({ missing: 1 }) as Record<string, unknown> }))
    expect(error).toMatchObject({
      code: 'CONFIG_FORM_VALUE_REFERENCE_MISSING',
      path: '$.nested',
    })
  })

  it('defensively clones inputs, context values, and every returned snapshot', () => {
    const source = { nested: [{ value: 1 }] }
    const input: ConfigFormValueInput = {
      direct: { $ref: { kind: 'field', nodeId: 'source' } },
      plain: { item: { value: 2 } },
    }
    const first = resolveConfigFormValueInput(input, { fields: { source } }) as {
      direct: { nested: Array<{ value: number }> }
      plain: { item: { value: number } }
    }
    first.direct.nested[0]!.value = 9
    first.plain.item.value = 8

    expect(source.nested[0]!.value).toBe(1)
    expect((input.plain as { item: { value: number } }).item.value).toBe(2)
    expect(resolveConfigFormValueInput(input, { fields: { source } })).toEqual({
      direct: { nested: [{ value: 1 }] },
      plain: { item: { value: 2 } },
    })
  })

  it('treats literal values as an escape boundary for nested business objects', () => {
    const nested = { $ref: { kind: 'field', nodeId: 'business-field' } }
    const input = {
      $ref: {
        kind: 'literal',
        value: { config: nested },
      },
    } as ConfigFormValueInput

    const resolved = resolveConfigFormValueInput(input, {}) as { config: typeof nested }
    const remapped = remapConfigFormValueReferences(input, {
      fields: { 'business-field': 'must-not-change' },
    })

    expect(resolved).toEqual({ config: nested })
    expect(resolved.config).not.toBe(nested)
    expect(collectConfigFormValueReferences(input)).toEqual([])
    expect(remapped).toEqual(input)
    expect(remapped).not.toBe(input)
  })

  it('collects direct and stable expression identities with scopes and JSON paths', () => {
    const input: ConfigFormValueInput = {
      field: { $ref: { kind: 'field', nodeId: 'customer', scope: 'root' } },
      formula: {
        $ref: {
          kind: 'expression',
          source: '$fields["quantity"] * $variables["price"]',
        },
      },
      nested: [{ $ref: { kind: 'variable', variableId: 'status' } }],
    }

    expect(collectConfigFormValueReferences(input)).toEqual([
      { id: 'customer', kind: 'field', path: '$.field', scope: 'root' },
      { id: 'quantity', kind: 'field', path: '$.formula', scope: 'current' },
      { id: 'price', kind: 'variable', path: '$.formula' },
      { id: 'status', kind: 'variable', path: '$.nested[0]' },
    ])
    expect(resolveConfigFormValueInput(input, {
      fields: { customer: 'Ada', quantity: 3 },
      resolveField: (id, scope) => ({
        found: scope === 'root' ? id === 'customer' : id === 'quantity',
        value: scope === 'root' ? 'Ada' : 3,
      }),
      variables: { price: 5, status: { ok: true } },
    })).toEqual({ field: 'Ada', formula: 15, nested: [{ ok: true }] })
  })

  it('remaps direct and expression identities through the AST without replacing string literals', () => {
    const input: ConfigFormValueInput = {
      direct: { $ref: { kind: 'field', nodeId: 'field-old' } },
      formula: {
        $ref: {
          kind: 'expression',
          source: '$fields["field-old"] + $variables["var-old"] + "field-old"',
        },
      },
    }
    const remapped = remapConfigFormValueReferences(input, {
      fields: new Map([['field-old', 'field-new']]),
      variables: { 'var-old': 'var-new' },
    }) as typeof input
    const source = (remapped.formula as { $ref: { source: string } }).$ref.source

    expect(remapped.direct).toEqual({ $ref: { kind: 'field', nodeId: 'field-new' } })
    expect(source).toContain('$fields["field-new"]')
    expect(source).toContain('$variables["var-new"]')
    expect(source).toContain('"field-old"')
    expect(resolveConfigFormValueInput(remapped, {
      fields: { 'field-new': 1 },
      variables: { 'var-new': 2 },
    })).toEqual({ direct: 1, formula: '3field-old' })
  })

  it('rejects removed Flow output references and expression roots', () => {
    const direct = readValueError(() => collectConfigFormValueReferences(invalidInput({
      $ref: { kind: 'output', stepId: 'save' },
    })))
    expect(direct).toMatchObject({
      code: 'CONFIG_FORM_VALUE_REFERENCE_INVALID',
      path: '$.$ref.kind',
    })

    const expression = readValueError(() => collectConfigFormValueReferences({
      $ref: { kind: 'expression', source: '$outputs["save"]' },
    }))
    expect(expression).toMatchObject({
      code: 'CONFIG_FORM_VALUE_EXPRESSION_IDENTIFIER_UNTRACKABLE',
      path: '$',
    })

    const remap = readValueError(() => remapConfigFormValueReferences(null, {
      outputs: { save: 'next' },
    } as unknown as ConfigFormValueReferenceRemap))
    expect(remap).toMatchObject({
      code: 'CONFIG_FORM_VALUE_REMAP_INVALID',
      path: '$maps.outputs',
    })
  })

  it('diagnoses malformed, dynamic, untrackable, and unresolved expressions', () => {
    const dynamic = readValueError(() => collectConfigFormValueReferences({
      $ref: { kind: 'expression', source: '$fields[$event.id]' },
    }))
    expect(dynamic).toMatchObject({
      code: 'CONFIG_FORM_VALUE_EXPRESSION_REFERENCE_DYNAMIC',
      path: '$',
    })

    const untrackable = readValueError(() => collectConfigFormValueReferences({
      $ref: { kind: 'expression', source: 'fieldName + 1' },
    }))
    expect(untrackable.code).toBe('CONFIG_FORM_VALUE_EXPRESSION_IDENTIFIER_UNTRACKABLE')

    const malformed = readValueError(() => remapConfigFormValueReferences({
      $ref: { kind: 'expression', source: '$fields[' },
    }, {}))
    expect(malformed.code).toMatch(/^CONFIG_FORM_EXPRESSION_/)

    const missing = readValueError(() => resolveConfigFormValueInput({
      $ref: { kind: 'expression', source: '$variables["missing"]' },
    }, { variables: {} }))
    expect(missing).toMatchObject({ code: 'CONFIG_FORM_VALUE_REFERENCE_MISSING', path: '$' })
  })

  it('rejects unknown wrapper shapes, reference properties, prototypes, unsafe keys, and cycles', () => {
    expect(readValueError(() => resolveConfigFormValueInput(invalidInput({
      $ref: { kind: 'variable', variableId: 'x' },
      extra: true,
    }), {})).code).toBe('CONFIG_FORM_VALUE_REFERENCE_WRAPPER_INVALID')

    const unknown = readValueError(() => collectConfigFormValueReferences(invalidInput({
      $ref: { kind: 'variable', variableId: 'x', extra: true },
    })))
    expect(unknown).toMatchObject({
      code: 'CONFIG_FORM_VALUE_REFERENCE_INVALID',
      path: '$.$ref.extra',
    })

    expect(readValueError(() => resolveConfigFormValueInput(invalidInput(new Date()), {})).code)
      .toBe('CONFIG_FORM_VALUE_INPUT_INVALID')

    const unsafe = Object.create(null) as Record<string, unknown>
    Object.defineProperty(unsafe, '__proto__', { enumerable: true, value: 1 })
    const unsafeError = readValueError(() => collectConfigFormValueReferences(invalidInput(unsafe)))
    expect(unsafeError).toMatchObject({ code: 'CONFIG_FORM_VALUE_UNSAFE_KEY' })

    const cyclic: unknown[] = []
    cyclic.push(cyclic)
    expect(readValueError(() => resolveConfigFormValueInput(invalidInput(cyclic), {})).code)
      .toBe('CONFIG_FORM_VALUE_CYCLE')
  })

  it('enforces depth 32 and 10000 visits with stable diagnostics', () => {
    let deep: unknown = null
    for (let index = 0; index < 33; index += 1)
      deep = [deep]
    const depth = readValueError(() => collectConfigFormValueReferences(invalidInput(deep)))
    expect(depth.code).toBe('CONFIG_FORM_VALUE_DEPTH_EXCEEDED')
    expect(depth.path).toContain('[0]')

    const wide = Array.from({ length: 10_001 }).fill(null)
    const visits = readValueError(() => remapConfigFormValueReferences(invalidInput(wide), {}))
    expect(visits.code).toBe('CONFIG_FORM_VALUE_VISIT_LIMIT_EXCEEDED')
  })
})
