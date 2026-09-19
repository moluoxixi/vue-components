import type { SafeExpressionV1 } from '../src/session'
import { describe, expect, it } from 'vitest'
import {
  evaluateSafeExpression,
  readSafeExpression,
} from '../src/session'

function expression(ast: SafeExpressionV1['ast']): SafeExpressionV1 {
  return { version: 1, ast }
}

describe('safe expression v1', () => {
  it('reads exact AST shapes and rejects selectors outside values', () => {
    expect(readSafeExpression(expression({
      kind: 'reference',
      scope: 'values',
      selector: 'parent',
      path: ['name'],
    })).success).toBe(true)

    expect(readSafeExpression({
      version: 1,
      ast: {
        kind: 'reference',
        scope: 'parameters',
        selector: 'root',
        path: ['name'],
      },
    })).toMatchObject({
      success: false,
      diagnostics: [{ code: 'interaction_expression_invalid' }],
    })
  })

  it('evaluates strict JSON operations without JavaScript coercion', () => {
    expect(evaluateSafeExpression(expression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'literal', value: { b: 2, a: [1, true] } },
      right: { kind: 'literal', value: { a: [1, true], b: 2 } },
    }), { values: {}, parameters: {}, scopeValues: { current: {}, parent: {}, root: {} } })).toEqual({
      success: true,
      value: true,
    })

    expect(evaluateSafeExpression(expression({
      kind: 'binary',
      operator: '==',
      left: { kind: 'literal', value: 1 },
      right: { kind: 'literal', value: '1' },
    }), { values: {}, parameters: {}, scopeValues: { current: {}, parent: {}, root: {} } })).toEqual({
      success: true,
      value: false,
    })
  })

  it('keeps missing values private to coalesce and blocks unsafe paths', () => {
    const context = {
      values: {},
      parameters: {},
      scopeValues: { current: {}, parent: {}, root: {} },
    }
    expect(evaluateSafeExpression(expression({
      kind: 'call',
      callee: 'coalesce',
      args: [
        { kind: 'reference', scope: 'values', path: ['missing'] },
        { kind: 'literal', value: 'fallback' },
      ],
    }), context)).toEqual({ success: true, value: 'fallback' })

    expect(evaluateSafeExpression(expression({
      kind: 'reference',
      scope: 'values',
      path: ['missing'],
    }), context)).toMatchObject({ success: false })

    expect(readSafeExpression(expression({
      kind: 'reference',
      scope: 'values',
      path: ['constructor'],
    })).success).toBe(false)
  })
})
