import type {
  PrototypeDiagnostic,
  PrototypeReadResult,
  SafeExpressionFunction,
  SafeExpressionNode,
  SafeExpressionV1,
} from '../types'
import {
  SAFE_EXPRESSION_MAX_DEPTH,
  SAFE_EXPRESSION_MAX_NODES,
  SAFE_EXPRESSION_MAX_PATH_SEGMENTS,
  SAFE_EXPRESSION_VERSION,
} from '../constants'
import {
  cloneJson,
  deepFreeze,
  hasExactKeys,
  isJsonValue,
  isRecord,
  isSafePathSegment,
} from '../utils'

const REFERENCE_SCOPES = new Set(['values', 'parameters', 'result', 'item'])
const SELECTORS = new Set(['current', 'parent', 'root'])
const UNARY_OPERATORS = new Set(['!', '-', '+'])
const BINARY_OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  '&&',
  '||',
])
const FUNCTIONS = new Set<SafeExpressionFunction>([
  'coalesce',
  'length',
  'trim',
  'lower',
  'upper',
  'includes',
  'startsWith',
  'endsWith',
])

interface ExpressionReadState {
  count: number
  diagnostic?: PrototypeDiagnostic
}

function invalid(message: string, path: readonly (string | number)[]): PrototypeDiagnostic {
  return {
    code: 'interaction_expression_invalid',
    message,
    path,
  }
}

function readPath(
  input: unknown,
  path: readonly (string | number)[],
  state: ExpressionReadState,
): string[] | undefined {
  if (!Array.isArray(input) || input.length > SAFE_EXPRESSION_MAX_PATH_SEGMENTS) {
    state.diagnostic = invalid(
      `Expression reference paths must contain at most ${SAFE_EXPRESSION_MAX_PATH_SEGMENTS} segments.`,
      path,
    )
    return undefined
  }
  if (!input.every(isSafePathSegment)) {
    state.diagnostic = invalid('Expression reference paths require non-empty safe segments.', path)
    return undefined
  }
  return [...input]
}

function readNode(
  input: unknown,
  path: readonly (string | number)[],
  depth: number,
  state: ExpressionReadState,
): SafeExpressionNode | undefined {
  state.count += 1
  if (state.count > SAFE_EXPRESSION_MAX_NODES) {
    state.diagnostic = invalid(`Expression AST cannot exceed ${SAFE_EXPRESSION_MAX_NODES} nodes.`, path)
    return undefined
  }
  if (depth > SAFE_EXPRESSION_MAX_DEPTH) {
    state.diagnostic = invalid(`Expression AST cannot exceed depth ${SAFE_EXPRESSION_MAX_DEPTH}.`, path)
    return undefined
  }
  if (!isRecord(input) || typeof input.kind !== 'string') {
    state.diagnostic = invalid('Expression nodes require a recognized kind.', path)
    return undefined
  }

  switch (input.kind) {
    case 'literal': {
      if (!hasExactKeys(input, ['kind', 'value']) || !isJsonValue(input.value)) {
        state.diagnostic = invalid('Expression literals must be exact JSON values.', path)
        return undefined
      }
      return { kind: 'literal', value: cloneJson(input.value) }
    }
    case 'reference': {
      if (!REFERENCE_SCOPES.has(String(input.scope))) {
        state.diagnostic = invalid('Expression reference scope is not supported.', [...path, 'scope'])
        return undefined
      }
      const valuesReference = input.scope === 'values'
      if (!hasExactKeys(input, ['kind', 'scope', 'path'], valuesReference ? ['selector'] : [])) {
        state.diagnostic = invalid('Expression reference contains unknown or missing fields.', path)
        return undefined
      }
      if (!valuesReference && Object.hasOwn(input, 'selector')) {
        state.diagnostic = invalid('Only values references may select current, parent, or root scope.', [...path, 'selector'])
        return undefined
      }
      if (valuesReference && input.selector !== undefined && !SELECTORS.has(String(input.selector))) {
        state.diagnostic = invalid('Values reference selector is not supported.', [...path, 'selector'])
        return undefined
      }
      const referencePath = readPath(input.path, [...path, 'path'], state)
      if (!referencePath)
        return undefined
      if (valuesReference) {
        return {
          kind: 'reference',
          scope: 'values',
          ...(input.selector === undefined
            ? {}
            : { selector: input.selector as 'current' | 'parent' | 'root' }),
          path: referencePath,
        }
      }
      return {
        kind: 'reference',
        scope: input.scope as 'parameters' | 'result' | 'item',
        path: referencePath,
      }
    }
    case 'array': {
      if (!hasExactKeys(input, ['kind', 'items']) || !Array.isArray(input.items)) {
        state.diagnostic = invalid('Expression array nodes require an items array.', path)
        return undefined
      }
      const items: SafeExpressionNode[] = []
      for (let index = 0; index < input.items.length; index += 1) {
        const item = readNode(input.items[index], [...path, 'items', index], depth + 1, state)
        if (!item)
          return undefined
        items.push(item)
      }
      return { kind: 'array', items }
    }
    case 'unary': {
      if (!hasExactKeys(input, ['kind', 'operator', 'operand']) || !UNARY_OPERATORS.has(String(input.operator))) {
        state.diagnostic = invalid('Expression unary operator is not supported.', path)
        return undefined
      }
      const operand = readNode(input.operand, [...path, 'operand'], depth + 1, state)
      return operand
        ? { kind: 'unary', operator: input.operator as '!' | '-' | '+', operand }
        : undefined
    }
    case 'binary': {
      if (!hasExactKeys(input, ['kind', 'operator', 'left', 'right']) || !BINARY_OPERATORS.has(String(input.operator))) {
        state.diagnostic = invalid('Expression binary operator is not supported.', path)
        return undefined
      }
      const left = readNode(input.left, [...path, 'left'], depth + 1, state)
      if (!left)
        return undefined
      const right = readNode(input.right, [...path, 'right'], depth + 1, state)
      return right
        ? { kind: 'binary', operator: input.operator as Extract<SafeExpressionNode, { kind: 'binary' }>['operator'], left, right }
        : undefined
    }
    case 'conditional': {
      if (!hasExactKeys(input, ['kind', 'test', 'consequent', 'alternate'])) {
        state.diagnostic = invalid('Expression conditional contains unknown or missing fields.', path)
        return undefined
      }
      const test = readNode(input.test, [...path, 'test'], depth + 1, state)
      if (!test)
        return undefined
      const consequent = readNode(input.consequent, [...path, 'consequent'], depth + 1, state)
      if (!consequent)
        return undefined
      const alternate = readNode(input.alternate, [...path, 'alternate'], depth + 1, state)
      return alternate ? { kind: 'conditional', test, consequent, alternate } : undefined
    }
    case 'call': {
      if (!hasExactKeys(input, ['kind', 'callee', 'args']) || !FUNCTIONS.has(input.callee as SafeExpressionFunction) || !Array.isArray(input.args)) {
        state.diagnostic = invalid('Expression call is not supported.', path)
        return undefined
      }
      const callee = input.callee as SafeExpressionFunction
      const validArity = callee === 'coalesce'
        ? input.args.length > 0
        : callee === 'length' || callee === 'trim' || callee === 'lower' || callee === 'upper'
          ? input.args.length === 1
          : input.args.length === 2
      if (!validArity) {
        state.diagnostic = invalid(`Expression function ${callee} received an invalid number of arguments.`, [...path, 'args'])
        return undefined
      }
      const args: SafeExpressionNode[] = []
      for (let index = 0; index < input.args.length; index += 1) {
        const argument = readNode(input.args[index], [...path, 'args', index], depth + 1, state)
        if (!argument)
          return undefined
        args.push(argument)
      }
      return { kind: 'call', callee, args }
    }
    default:
      state.diagnostic = invalid(`Expression node kind is not supported: ${input.kind}.`, [...path, 'kind'])
      return undefined
  }
}

export function readSafeExpression(input: unknown): PrototypeReadResult<SafeExpressionV1> {
  if (!isRecord(input) || input.version !== SAFE_EXPRESSION_VERSION) {
    return {
      success: false,
      diagnostics: [{
        code: 'unsupported_contract_version',
        message: `Safe Expression requires version ${SAFE_EXPRESSION_VERSION}.`,
        path: ['version'],
        context: {
          contract: 'SafeExpression',
          expected: SAFE_EXPRESSION_VERSION,
          received: isRecord(input) && isJsonValue(input.version) ? input.version : null,
        },
      }],
    }
  }
  if (!hasExactKeys(input, ['version', 'ast'])) {
    return { success: false, diagnostics: [invalid('Safe Expression contains unknown or missing fields.', [])] }
  }
  const state: ExpressionReadState = { count: 0 }
  const ast = readNode(input.ast, ['ast'], 1, state)
  if (!ast)
    return { success: false, diagnostics: [state.diagnostic ?? invalid('Safe Expression is invalid.', ['ast'])] }
  return {
    success: true,
    data: deepFreeze({ version: SAFE_EXPRESSION_VERSION, ast }) as SafeExpressionV1,
    diagnostics: [],
  }
}
