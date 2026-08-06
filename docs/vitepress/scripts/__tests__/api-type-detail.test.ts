// @vitest-environment node

import type { ComponentContract } from '@moluoxixi/ai-doc-assistant'
import { describe, expect, it } from 'vitest'
import { createTypeDetail } from '../api-type-detail.mts'

type TypeDefinition = ComponentContract['typeDefs'][number]

function field(name: string, type: string): TypeDefinition['fields'][number] {
  return { name, type, optional: false, description: '' }
}

function definition(name: string, raw: string, fields: TypeDefinition['fields'] = []): TypeDefinition {
  return {
    name,
    kind: raw.includes('interface') ? 'interface' : 'type',
    fields,
    raw,
  }
}

describe('api type detail', () => {
  it('keeps direct and transitive definitions in reference order', () => {
    const typeDefs = [
      definition('FieldKey', 'type FieldKey<T> = Extract<keyof T, string>'),
      definition('Values', 'type Values = Record<string, unknown>'),
      definition(
        'Payload',
        'interface Payload<T extends Values> {\n  field: FieldKey<T>\n  values: T\n}',
        [field('field', 'FieldKey<T>'), field('values', 'T')],
      ),
    ]

    const detail = createTypeDetail(typeDefs, 'Payload<Values>', ['Payload', 'Values'])!

    expect(detail).toContain('interface Payload')
    expect(detail).toContain('type Values')
    expect(detail).toContain('type FieldKey')
    expect(detail.indexOf('interface Payload')).toBeLessThan(detail.indexOf('type Values'))
  })

  it('follows union type aliases without treating comments as dependencies', () => {
    const typeDefs = [
      definition('SlotScope', '/** IgnoredScope is only documentation. */\ntype SlotScope = HeaderScope | CellScope'),
      definition('HeaderScope', 'interface HeaderScope {\n  columnIndex: number\n}', [field('columnIndex', 'number')]),
      definition('CellScope', 'interface CellScope {\n  rowIndex: number\n}', [field('rowIndex', 'number')]),
      definition('IgnoredScope', 'interface IgnoredScope {\n  ignored: true\n}', [field('ignored', 'true')]),
    ]

    const detail = createTypeDetail(typeDefs, 'SlotScope', ['SlotScope'])!

    expect(detail).toContain('interface HeaderScope')
    expect(detail).toContain('interface CellScope')
    expect(detail).not.toContain('interface IgnoredScope')
  })

  it('ignores identifiers in literals while following generic constraints and defaults', () => {
    const typeDefs = [
      definition('Alias', `type Alias<T extends Dependency = Fallback> = T | 'LiteralDependency'`),
      definition('Dependency', 'interface Dependency {\n  id: string\n}', [field('id', 'string')]),
      definition('Fallback', 'interface Fallback {\n  fallback: true\n}', [field('fallback', 'true')]),
      definition('LiteralDependency', 'interface LiteralDependency {\n  ignored: true\n}', [field('ignored', 'true')]),
    ]

    const detail = createTypeDetail(typeDefs, 'Alias', ['Alias'])!

    expect(detail).toContain('interface Dependency')
    expect(detail).toContain('interface Fallback')
    expect(detail).not.toContain('interface LiteralDependency')
  })

  it('does not expand locally bound generic names', () => {
    const typeDefs = [
      definition('GenericAlias', 'type GenericAlias<Other> = Other'),
      definition('Other', 'interface Other {\n  value: string\n}', [field('value', 'string')]),
    ]

    const detail = createTypeDetail(typeDefs, 'GenericAlias', ['GenericAlias'])!

    expect(detail).not.toContain('interface Other')
  })

  it('does not expand names introduced by infer clauses', () => {
    const typeDefs = [
      definition('ConditionalAlias', 'type ConditionalAlias<Value> = Value extends infer Other ? Other : never'),
      definition('Other', 'interface Other {\n  value: string\n}', [field('value', 'string')]),
    ]

    const detail = createTypeDetail(typeDefs, 'ConditionalAlias<string>', ['ConditionalAlias'])!

    expect(detail).not.toContain('interface Other')
  })

  it('keeps every summarized direct definition structurally complete', () => {
    const fields = Array.from({ length: 40 }, (_, index) => field(`field${index}`, 'string'))
    const rawFields = fields.map(item => `  ${item.name}: ${item.type}`).join('\n')
    const typeDefs = [
      definition('LargeOptions', `interface LargeOptions {\n${rawFields}\n}`, fields),
      definition('NestedOptions', `interface NestedOptions {\n${rawFields}\n}`, fields),
    ]

    const detail = createTypeDetail(typeDefs, 'LargeOptions & NestedOptions', ['LargeOptions', 'NestedOptions'])!

    expect(detail.split('\n').length).toBeLessThanOrEqual(18)
    expect(detail).toContain('interface LargeOptions {')
    expect(detail).toContain('interface NestedOptions {')
    expect(detail.match(/^\}$/gm)).toHaveLength(2)
    expect(detail).toContain('additional referenced type details omitted')
  })

  it('does not infer dependencies from field names or comments', () => {
    const typeDefs = [
      definition(
        'Options',
        '/** User is a label, not a type. */\ninterface Options {\n  User: string\n  nested: Nested\n}',
        [field('User', 'string'), field('nested', 'Nested')],
      ),
      definition('User', 'interface User {\n  id: string\n}', [field('id', 'string')]),
      definition('Nested', 'interface Nested {\n  enabled: boolean\n}', [field('enabled', 'boolean')]),
    ]

    const detail = createTypeDetail(typeDefs, 'Options', ['Options'])!

    expect(detail).toContain('interface Nested')
    expect(detail).not.toContain('interface User {')
  })

  it('marks a long non-object type alias as truncated instead of inventing an object', () => {
    const union = Array.from({ length: 260 }, (_, index) => `'value-${index}'`).join(' | ')
    const detail = createTypeDetail(
      [definition('HugeUnion', `type HugeUnion = ${union}`)],
      'HugeUnion',
      ['HugeUnion'],
    )!

    expect(detail).toContain('type HugeUnion =')
    expect(detail).toContain('type definition truncated')
    expect(detail).not.toContain('type HugeUnion {')
  })

  it('uses a distinct message when only the type expression is truncated', () => {
    const detail = createTypeDetail([], `'${'x'.repeat(220)}'`, [])!

    expect(detail).toContain('type expression truncated')
    expect(detail).not.toContain('referenced type details omitted')
  })

  it('terminates cycles and emits each definition once', () => {
    const typeDefs = [
      definition('A', 'interface A {\n  b: B\n}', [field('b', 'B')]),
      definition('B', 'interface B {\n  a: A\n}', [field('a', 'A')]),
    ]
    const detail = createTypeDetail(typeDefs, 'A', ['A', 'A'])!

    expect(detail.match(/interface A/g)).toHaveLength(1)
    expect(detail.match(/interface B/g)).toHaveLength(1)
  })

  it('leaves concise type definitions intact', () => {
    const raw = 'interface RequestOption {\n  label: string\n  value: string | number\n}'

    expect(createTypeDetail(
      [definition('RequestOption', raw, [field('label', 'string'), field('value', 'string | number')])],
      'RequestOption[]',
      ['RequestOption'],
    )).toBe(`RequestOption[]\n\n${raw}`)
  })
})
