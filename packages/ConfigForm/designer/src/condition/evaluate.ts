import type {
  CompiledDesignerCondition,
  DesignerConditionExpression,
  DesignerConditionOperand,
  DesignerConditionValues,
} from './types'

function resolveOperand(operand: DesignerConditionOperand, values: DesignerConditionValues): unknown {
  return operand.kind === 'field' ? values[operand.field] : operand.value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function equalValues(left: unknown, right: unknown): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => equalValues(value, right[index]))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key => Object.hasOwn(right, key) && equalValues(left[key], right[key]))
  }
  return false
}

function comparableValue(value: unknown): number | string | undefined {
  if (value instanceof Date)
    return value.getTime()
  return typeof value === 'number' || typeof value === 'string' ? value : undefined
}

function compareOrdered(left: unknown, right: unknown, operator: 'gt' | 'gte' | 'lt' | 'lte'): boolean {
  const comparableLeft = comparableValue(left)
  const comparableRight = comparableValue(right)
  if (comparableLeft === undefined || comparableRight === undefined || typeof comparableLeft !== typeof comparableRight)
    return false

  switch (operator) {
    case 'gt': return comparableLeft > comparableRight
    case 'gte': return comparableLeft >= comparableRight
    case 'lt': return comparableLeft < comparableRight
    case 'lte': return comparableLeft <= comparableRight
  }
}

function compareValues(
  left: unknown,
  right: unknown,
  operator: Extract<DesignerConditionExpression, { kind: 'compare' }>['operator'],
): boolean {
  switch (operator) {
    case 'eq': return equalValues(left, right)
    case 'neq': return !equalValues(left, right)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareOrdered(left, right, operator)
    case 'in':
      return Array.isArray(right) && right.some(value => equalValues(left, value))
    case 'contains':
      if (typeof left === 'string' && typeof right === 'string')
        return left.includes(right)
      return Array.isArray(left) && left.some(value => equalValues(value, right))
  }
}

export function evaluateDesignerCondition(
  expression: DesignerConditionExpression,
  values: DesignerConditionValues,
): boolean {
  switch (expression.kind) {
    case 'literal': return expression.value
    case 'compare':
      return compareValues(
        resolveOperand(expression.left, values),
        resolveOperand(expression.right, values),
        expression.operator,
      )
    case 'and': return expression.expressions.every(item => evaluateDesignerCondition(item, values))
    case 'or': return expression.expressions.some(item => evaluateDesignerCondition(item, values))
    case 'not': return !evaluateDesignerCondition(expression.expression, values)
  }
}

export function compileDesignerCondition(expression: DesignerConditionExpression): CompiledDesignerCondition {
  return values => evaluateDesignerCondition(expression, values)
}
