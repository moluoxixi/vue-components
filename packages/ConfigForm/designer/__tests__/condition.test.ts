import { describe, expect, it } from 'vitest'
import { compileDesignerCondition, evaluateDesignerCondition } from '../index'

describe('designer conditions', () => {
  it('evaluates nested boolean and comparison expressions', () => {
    const expression = {
      kind: 'and' as const,
      expressions: [
        {
          kind: 'compare' as const,
          operator: 'gte' as const,
          left: { kind: 'field' as const, field: 'age' },
          right: { kind: 'literal' as const, value: 18 },
        },
        {
          kind: 'not' as const,
          expression: {
            kind: 'compare' as const,
            operator: 'in' as const,
            left: { kind: 'field' as const, field: 'role' },
            right: { kind: 'literal' as const, value: ['blocked', 'guest'] },
          },
        },
      ],
    }

    const condition = compileDesignerCondition(expression)
    expect(condition({ age: 20, role: 'editor' })).toBe(true)
    expect(condition({ age: 17, role: 'editor' })).toBe(false)
    expect(condition({ age: 20, role: 'blocked' })).toBe(false)
  })

  it('uses structural JSON equality and deterministic contains semantics', () => {
    expect(evaluateDesignerCondition({
      kind: 'compare',
      operator: 'eq',
      left: { kind: 'field', field: 'filters' },
      right: { kind: 'literal', value: { status: ['open'] } },
    }, { filters: { status: ['open'] } })).toBe(true)

    expect(evaluateDesignerCondition({
      kind: 'compare',
      operator: 'contains',
      left: { kind: 'field', field: 'tags' },
      right: { kind: 'literal', value: 'admin' },
    }, { tags: ['user', 'admin'] })).toBe(true)
  })
})
