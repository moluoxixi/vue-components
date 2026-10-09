import type { SafeExpression } from '@moluoxixi/config-form-model'
import { describe, expect, it } from 'vitest'
import { evaluateStudioExpression } from '../services/expression-preview'

describe('studio expression preview', () => {
  it('evaluates grouped, negated conditions with all sample scopes through the Experience evaluator', () => {
    const expression: SafeExpression = { version: 1, ast: { kind: 'binary', operator: '&&', left: { kind: 'binary', operator: '>=', left: { kind: 'reference', scope: 'values', path: ['amount'] }, right: { kind: 'literal', value: 10 } }, right: { kind: 'unary', operator: '!', operand: { kind: 'reference', scope: 'parameters', path: ['blocked'] } } } }
    expect(evaluateStudioExpression(expression, { values: { amount: 12 }, parameters: { blocked: false } })).toMatchObject({ success: true, value: true })
    expect(evaluateStudioExpression(expression, { values: { amount: 8 }, parameters: { blocked: false } })).toMatchObject({ success: true, value: false })
    expect(evaluateStudioExpression(expression, { values: { amount: 12 }, parameters: { blocked: true } })).toMatchObject({ success: true, value: false })
  })
})
