import { describe, expect, it } from 'vitest'
import {
  ConfigFormExpressionError,
  evaluateConfigFormExpression,
  parseConfigFormExpression,
  tryEvaluateConfigFormExpression,
} from '../index'

const values = {
  age: 20,
  items: [1, 2, 3],
  name: 'Ada',
  price: 12.5,
  quantity: 4,
  user: { profile: { city: 'Xi\'an' }, role: 'admin' },
}

describe('config form expression parsing', () => {
  it('parses literals, identifiers, paths, calls, and precedence into a serializable AST', () => {
    expect(parseConfigFormExpression('1 + 2 * 3')).toEqual({
      kind: 'binary',
      left: { kind: 'literal', value: 1 },
      operator: '+',
      right: {
        kind: 'binary',
        left: { kind: 'literal', value: 2 },
        operator: '*',
        right: { kind: 'literal', value: 3 },
      },
    })
    expect(parseConfigFormExpression('user.profile.city')).toEqual({
      kind: 'member',
      object: { kind: 'member', object: { kind: 'identifier', name: 'user' }, property: 'profile' },
      property: 'city',
    })
    const ast = parseConfigFormExpression('IF(age >= 18, "adult", "minor")')
    expect(ast).toMatchObject({ callee: 'IF', kind: 'call' })
    expect(JSON.parse(JSON.stringify(ast))).toEqual(ast)
  })

  it('rejects malformed sources with positioned diagnostics', () => {
    expect(() => parseConfigFormExpression('')).toThrow(ConfigFormExpressionError)
    expect(() => parseConfigFormExpression('1 +')).toThrow(/Unexpected end/)
    expect(() => parseConfigFormExpression('a ~ b')).toThrow(/Unexpected character/)
    expect(() => parseConfigFormExpression('(1 + 2')).toThrow(/Expected "\)"/)
    expect(() => parseConfigFormExpression('"open')).toThrow(/Unterminated string/)
    expect(() => parseConfigFormExpression('1 2')).toThrow(/after the expression/)
  })
})

describe('config form expression evaluation', () => {
  it('evaluates arithmetic, comparison, logic, ternary, and value paths', () => {
    expect(evaluateConfigFormExpression('price * quantity', values)).toBe(50)
    expect(evaluateConfigFormExpression('age >= 18 && user.role == "admin"', values)).toBe(true)
    expect(evaluateConfigFormExpression('age < 18 ? "minor" : "adult"', values)).toBe('adult')
    expect(evaluateConfigFormExpression('items[1] + items[2]', values)).toBe(5)
    expect(evaluateConfigFormExpression('"Hi " + name', values)).toBe('Hi Ada')
    expect(evaluateConfigFormExpression('-price + 0.5', values)).toBe(-12)
    expect(evaluateConfigFormExpression('!missing', values)).toBe(true)
    expect(evaluateConfigFormExpression('[age, name]', values)).toEqual([20, 'Ada'])
  })

  it('runs the built-in formula library case-insensitively', () => {
    expect(evaluateConfigFormExpression('SUM(items) + MIN(9, 4)', values)).toBe(10)
    expect(evaluateConfigFormExpression('round(price * 1.1, 1)', values)).toBe(13.8)
    expect(evaluateConfigFormExpression('CONCAT(UPPER(name), "-", LEN(items))', values)).toBe('ADA-3')
    expect(evaluateConfigFormExpression('IF(EMPTY(missing), "fallback", missing)', values)).toBe('fallback')
    expect(evaluateConfigFormExpression('DEFAULT(missing, 7)', values)).toBe(7)
    expect(evaluateConfigFormExpression('AVG(2, 4, [6, 8])', values)).toBe(5)
    expect(evaluateConfigFormExpression('INCLUDES(items, 2)', values)).toBe(true)
    expect(evaluateConfigFormExpression('JOIN(SPLIT("a,b", ","), "-")', values)).toBe('a-b')
  })

  it('stays inside the sandbox: no prototypes, no unknown functions, own properties only', () => {
    expect(evaluateConfigFormExpression('user.constructor', values)).toBeUndefined()
    expect(evaluateConfigFormExpression('name["__proto__"]', values)).toBeUndefined()
    expect(evaluateConfigFormExpression('user.toString', values)).toBeUndefined()
    expect(evaluateConfigFormExpression('missing.deep.path', values)).toBeUndefined()
    expect(() => evaluateConfigFormExpression('EVIL(1)', values)).toThrow(/Unknown function/)
    expect(evaluateConfigFormExpression('DOUBLE(age)', values, {
      functions: { DOUBLE: value => Number(value) * 2 },
    })).toBe(40)
  })

  it('reports failures through the non-throwing wrapper', () => {
    expect(tryEvaluateConfigFormExpression('price * quantity', values)).toEqual({ success: true, value: 50 })
    const failure = tryEvaluateConfigFormExpression('NOPE()', values)
    expect(failure.success).toBe(false)
    if (!failure.success)
      expect(failure.diagnostic.code).toBe('CONFIG_FORM_EXPRESSION_UNKNOWN_FUNCTION')
    const parseFailure = tryEvaluateConfigFormExpression('1 +', values)
    expect(parseFailure.success).toBe(false)
  })
})
