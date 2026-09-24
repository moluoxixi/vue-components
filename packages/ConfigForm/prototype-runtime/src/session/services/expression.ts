import type {
  ModelJsonValue,
  PrototypeDiagnostic,
  SafeExpressionEvaluationContext,
  SafeExpressionEvaluationResult,
  SafeExpressionNode,
  SafeExpressionV1,
} from '../types'
import { readSafeExpression } from '../schemas'
import { cloneJson, deepJsonEqual, isJsonValue, isRecord } from '../utils'

const MISSING = Symbol('safe-expression-missing')
type EvaluationValue = ModelJsonValue | typeof MISSING

class ExpressionEvaluationError extends Error {
  readonly diagnostic: PrototypeDiagnostic

  constructor(message: string) {
    super(message)
    this.name = 'ExpressionEvaluationError'
    this.diagnostic = {
      code: 'interaction_expression_invalid',
      message,
    }
  }
}

function fail(message: string): never {
  throw new ExpressionEvaluationError(message)
}

function requirePresent(value: EvaluationValue, operation: string): ModelJsonValue {
  if (value === MISSING)
    fail(`Expression ${operation} cannot consume a missing value.`)
  return value
}

function requireBoolean(value: EvaluationValue, operation: string): boolean {
  const present = requirePresent(value, operation)
  if (typeof present !== 'boolean')
    fail(`Expression ${operation} requires a boolean.`)
  return present
}

function requireNumber(value: EvaluationValue, operation: string): number {
  const present = requirePresent(value, operation)
  if (typeof present !== 'number' || !Number.isFinite(present))
    fail(`Expression ${operation} requires a finite number.`)
  return present
}

function readOwnPath(value: unknown, path: readonly string[]): EvaluationValue {
  let current: unknown = value
  for (const segment of path) {
    if ((typeof current !== 'object' || current === null) || !Object.hasOwn(current, segment))
      return MISSING
    current = (current as Record<string, unknown>)[segment]
  }
  return isJsonValue(current) ? cloneJson(current) : MISSING
}

function evaluateReference(
  node: Extract<SafeExpressionNode, { kind: 'reference' }>,
  context: SafeExpressionEvaluationContext,
): EvaluationValue {
  if (node.scope === 'values') {
    const selector = node.selector ?? 'current'
    return readOwnPath(context.scopeValues[selector], node.path)
  }
  if (node.scope === 'parameters')
    return readOwnPath(context.parameters, node.path)
  if (node.scope === 'result')
    return context.result === undefined ? MISSING : readOwnPath(context.result, node.path)
  return context.item === undefined ? MISSING : readOwnPath(context.item, node.path)
}

function finiteResult(value: number, operator: string): number {
  if (!Number.isFinite(value))
    fail(`Expression ${operator} produced a non-finite result.`)
  return value
}

function evaluateBinary(
  node: Extract<SafeExpressionNode, { kind: 'binary' }>,
  context: SafeExpressionEvaluationContext,
): EvaluationValue {
  const left = evaluateNode(node.left, context)
  if (node.operator === '&&')
    return requireBoolean(left, '&&') ? requireBoolean(evaluateNode(node.right, context), '&&') : false
  if (node.operator === '||')
    return requireBoolean(left, '||') ? true : requireBoolean(evaluateNode(node.right, context), '||')

  const right = evaluateNode(node.right, context)
  if (node.operator === '==' || node.operator === '!=') {
    const equal = deepJsonEqual(requirePresent(left, node.operator), requirePresent(right, node.operator))
    return node.operator === '==' ? equal : !equal
  }
  if (node.operator === '>' || node.operator === '>=' || node.operator === '<' || node.operator === '<=') {
    const leftValue = requirePresent(left, node.operator)
    const rightValue = requirePresent(right, node.operator)
    if ((typeof leftValue !== 'number' || typeof rightValue !== 'number')
      && (typeof leftValue !== 'string' || typeof rightValue !== 'string')) {
      fail(`Expression ${node.operator} requires two numbers or two strings.`)
    }
    switch (node.operator) {
      case '>': return leftValue > rightValue
      case '>=': return leftValue >= rightValue
      case '<': return leftValue < rightValue
      case '<=': return leftValue <= rightValue
    }
  }

  const leftNumber = requireNumber(left, node.operator)
  const rightNumber = requireNumber(right, node.operator)
  switch (node.operator) {
    case '+': return finiteResult(leftNumber + rightNumber, '+')
    case '-': return finiteResult(leftNumber - rightNumber, '-')
    case '*': return finiteResult(leftNumber * rightNumber, '*')
    case '/':
      if (rightNumber === 0)
        fail('Expression division by zero is invalid.')
      return finiteResult(leftNumber / rightNumber, '/')
    case '%':
      if (rightNumber === 0)
        fail('Expression modulo by zero is invalid.')
      return finiteResult(leftNumber % rightNumber, '%')
  }
}

function evaluateCall(
  node: Extract<SafeExpressionNode, { kind: 'call' }>,
  context: SafeExpressionEvaluationContext,
): ModelJsonValue {
  if (node.callee === 'coalesce') {
    for (const argument of node.args) {
      const value = evaluateNode(argument, context)
      if (value !== MISSING && value !== null)
        return cloneJson(value)
    }
    return null
  }
  const args = node.args.map(argument => requirePresent(evaluateNode(argument, context), node.callee))
  switch (node.callee) {
    case 'length':
      if (typeof args[0] !== 'string' && !Array.isArray(args[0]))
        fail('Expression length requires one string or array.')
      return args[0].length
    case 'trim':
    case 'lower':
    case 'upper': {
      const value = args[0]
      if (typeof value !== 'string')
        fail(`Expression ${node.callee} requires one string.`)
      return node.callee === 'trim' ? value.trim() : node.callee === 'lower' ? value.toLowerCase() : value.toUpperCase()
    }
    case 'startsWith':
    case 'endsWith': {
      const [value, search] = args
      if (typeof value !== 'string' || typeof search !== 'string')
        fail(`Expression ${node.callee} requires two strings.`)
      return node.callee === 'startsWith' ? value.startsWith(search) : value.endsWith(search)
    }
    case 'includes': {
      const [value, search] = args
      if (typeof value === 'string') {
        if (typeof search !== 'string')
          fail('Expression includes requires string/string or array/JSON-value.')
        return value.includes(search)
      }
      if (Array.isArray(value))
        return value.some(item => deepJsonEqual(item, search!))
      fail('Expression includes requires string/string or array/JSON-value.')
    }
  }
}

function evaluateNode(node: SafeExpressionNode, context: SafeExpressionEvaluationContext): EvaluationValue {
  switch (node.kind) {
    case 'literal': return cloneJson(node.value)
    case 'reference': return evaluateReference(node, context)
    case 'array': return node.items.map(item => cloneJson(requirePresent(evaluateNode(item, context), 'array')))
    case 'unary': {
      const value = evaluateNode(node.operand, context)
      if (node.operator === '!')
        return !requireBoolean(value, '!')
      const number = requireNumber(value, node.operator)
      return node.operator === '+' ? number : finiteResult(-number, '-')
    }
    case 'binary': return evaluateBinary(node, context)
    case 'conditional':
      return requireBoolean(evaluateNode(node.test, context), 'conditional')
        ? evaluateNode(node.consequent, context)
        : evaluateNode(node.alternate, context)
    case 'call': return evaluateCall(node, context)
  }
}

export function evaluateSafeExpression(
  input: SafeExpressionV1 | unknown,
  context: SafeExpressionEvaluationContext,
): SafeExpressionEvaluationResult {
  const read = readSafeExpression(input)
  if (!read.success)
    return { success: false, diagnostic: read.diagnostics[0]! }
  if (!isRecord(context.values) || !isRecord(context.parameters)
    || !isRecord(context.scopeValues.current) || !isRecord(context.scopeValues.parent)
    || !isRecord(context.scopeValues.root)) {
    return {
      success: false,
      diagnostic: {
        code: 'interaction_expression_invalid',
        message: 'Expression evaluation context is not JSON object shaped.',
      },
    }
  }
  try {
    const value = requirePresent(evaluateNode(read.data.ast, context), 'result')
    if (!isJsonValue(value))
      fail('Expression result is not JSON-safe.')
    return { success: true, value: cloneJson(value) }
  }
  catch (error) {
    if (error instanceof ExpressionEvaluationError)
      return { success: false, diagnostic: error.diagnostic }
    throw error
  }
}
