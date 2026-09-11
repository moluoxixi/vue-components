import type {
  ConfigFormExpressionEvaluateOptions,
  ConfigFormExpressionNode,
  ConfigFormExpressionResult,
} from '../types'
import { CONFIG_FORM_EXPRESSION_FUNCTIONS } from './functions'
import {
  CONFIG_FORM_EXPRESSION_MAX_DEPTH,
  ConfigFormExpressionError,
  parseConfigFormExpression,
} from './parser'

const BLOCKED_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype'])

function readProperty(object: unknown, key: string | number): unknown {
  if (object === null || object === undefined)
    return undefined
  if (typeof key === 'string' && BLOCKED_PROPERTIES.has(key))
    return undefined
  if (Array.isArray(object)) {
    const index = typeof key === 'number' ? key : Number(key)
    return Number.isInteger(index) ? object[index] : undefined
  }
  if (typeof object === 'object')
    return Object.hasOwn(object, key) ? (object as Record<string | number, unknown>)[key] : undefined
  return undefined
}

function deepEqual(left: unknown, right: unknown, depth = 0): boolean {
  if (depth > CONFIG_FORM_EXPRESSION_MAX_DEPTH)
    return false
  if (Object.is(left, right))
    return true
  if (left instanceof Date && right instanceof Date)
    return left.getTime() === right.getTime()
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => deepEqual(value, right[index], depth + 1))
  }
  if (typeof left === 'object' && typeof right === 'object' && left !== null && right !== null) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key => Object.hasOwn(right, key)
        && deepEqual((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], depth + 1))
  }
  return false
}

function compareOrdered(left: unknown, right: unknown, compare: (order: number) => boolean): boolean {
  const comparableLeft = left instanceof Date ? left.getTime() : left
  const comparableRight = right instanceof Date ? right.getTime() : right
  if (
    (typeof comparableLeft !== 'number' && typeof comparableLeft !== 'string')
    || typeof comparableLeft !== typeof comparableRight
  ) {
    return false
  }
  const normalizedRight = comparableRight as number | string
  if (comparableLeft === normalizedRight)
    return compare(0)
  return compare(comparableLeft > normalizedRight ? 1 : -1)
}

function toArithmeticNumber(value: unknown): number {
  if (value === null || value === undefined || value === '')
    return 0
  if (value instanceof Date)
    return value.getTime()
  const numeric = Number(value)
  if (Number.isNaN(numeric))
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_NOT_A_NUMBER', `Value ${JSON.stringify(value)} is not a number.`)
  return numeric
}

/**
 * Evaluates a parsed expression against a values scope. Identifier roots
 * resolve to own properties of the scope, property access never walks the
 * prototype chain, and only allow-listed functions are callable.
 */
export function evaluateConfigFormExpression(
  expression: ConfigFormExpressionNode | string,
  values: Record<string, unknown>,
  options: ConfigFormExpressionEvaluateOptions = {},
): unknown {
  const root = typeof expression === 'string' ? parseConfigFormExpression(expression) : expression

  function evaluateNode(node: ConfigFormExpressionNode, depth: number): unknown {
    if (depth > CONFIG_FORM_EXPRESSION_MAX_DEPTH)
      throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_DEPTH_EXCEEDED', `Expression exceeds the maximum depth of ${CONFIG_FORM_EXPRESSION_MAX_DEPTH}.`)
    switch (node.kind) {
      case 'literal':
        return node.value
      case 'identifier':
        return readProperty(values, node.name)
      case 'member':
        return readProperty(evaluateNode(node.object, depth + 1), node.property)
      case 'index': {
        const key = evaluateNode(node.index, depth + 1)
        return typeof key === 'string' || typeof key === 'number'
          ? readProperty(evaluateNode(node.object, depth + 1), key)
          : undefined
      }
      case 'array':
        return node.items.map(item => evaluateNode(item, depth + 1))
      case 'unary': {
        const operand = evaluateNode(node.operand, depth + 1)
        if (node.operator === '!')
          return !operand
        const numeric = toArithmeticNumber(operand)
        return node.operator === '-' ? -numeric : numeric
      }
      case 'binary':
        return evaluateBinary(node, depth)
      case 'conditional':
        return evaluateNode(node.test, depth + 1)
          ? evaluateNode(node.consequent, depth + 1)
          : evaluateNode(node.alternate, depth + 1)
      case 'call': {
        const registry = { ...CONFIG_FORM_EXPRESSION_FUNCTIONS, ...options.functions }
        const name = Object.keys(registry).find(key => key.toUpperCase() === node.callee.toUpperCase())
        const callable = name === undefined ? undefined : registry[name]
        if (!callable)
          throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNKNOWN_FUNCTION', `Unknown function "${node.callee}".`)
        return callable(...node.args.map(argument => evaluateNode(argument, depth + 1)))
      }
    }
  }

  function evaluateBinary(node: Extract<ConfigFormExpressionNode, { kind: 'binary' }>, depth: number): unknown {
    if (node.operator === '&&') {
      const left = evaluateNode(node.left, depth + 1)
      return left ? evaluateNode(node.right, depth + 1) : left
    }
    if (node.operator === '||') {
      const left = evaluateNode(node.left, depth + 1)
      return left || evaluateNode(node.right, depth + 1)
    }
    const left = evaluateNode(node.left, depth + 1)
    const right = evaluateNode(node.right, depth + 1)
    switch (node.operator) {
      case '==': return deepEqual(left, right)
      case '!=': return !deepEqual(left, right)
      case '>': return compareOrdered(left, right, order => order > 0)
      case '>=': return compareOrdered(left, right, order => order >= 0)
      case '<': return compareOrdered(left, right, order => order < 0)
      case '<=': return compareOrdered(left, right, order => order <= 0)
      case '+':
        if (typeof left === 'string' || typeof right === 'string')
          return `${left ?? ''}${right ?? ''}`
        return toArithmeticNumber(left) + toArithmeticNumber(right)
      case '-': return toArithmeticNumber(left) - toArithmeticNumber(right)
      case '*': return toArithmeticNumber(left) * toArithmeticNumber(right)
      case '/': return toArithmeticNumber(left) / toArithmeticNumber(right)
      case '%': return toArithmeticNumber(left) % toArithmeticNumber(right)
    }
  }

  return evaluateNode(root, 0)
}

/** Non-throwing wrapper used by flow conditions and reaction operands. */
export function tryEvaluateConfigFormExpression(
  expression: ConfigFormExpressionNode | string,
  values: Record<string, unknown>,
  options: ConfigFormExpressionEvaluateOptions = {},
): ConfigFormExpressionResult {
  try {
    return { success: true, value: evaluateConfigFormExpression(expression, values, options) }
  }
  catch (error) {
    if (error instanceof ConfigFormExpressionError)
      return { diagnostic: { code: error.code, message: error.message, position: error.position }, success: false }
    return {
      diagnostic: {
        code: 'CONFIG_FORM_EXPRESSION_EVALUATION_FAILED',
        message: error instanceof Error ? error.message : 'Expression evaluation failed.',
      },
      success: false,
    }
  }
}
