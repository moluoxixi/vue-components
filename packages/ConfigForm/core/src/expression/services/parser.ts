import type {
  ConfigFormExpressionBinaryOperator,
  ConfigFormExpressionNode,
} from '../types'

export const CONFIG_FORM_EXPRESSION_MAX_LENGTH = 10_000
export const CONFIG_FORM_EXPRESSION_MAX_DEPTH = 64

export class ConfigFormExpressionError extends Error {
  readonly code: string
  readonly position?: number

  constructor(code: string, message: string, position?: number) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
    this.code = code
    this.position = position
  }
}

interface ExpressionToken {
  type: 'number' | 'string' | 'identifier' | 'operator' | 'punctuation'
  value: string
  position: number
}

const OPERATORS = ['==', '!=', '>=', '<=', '&&', '||', '+', '-', '*', '/', '%', '>', '<', '!'] as const
const PUNCTUATION = new Set(['(', ')', '[', ']', ',', '.', '?', ':'])
const KEYWORD_LITERALS: Record<string, boolean | null> = {
  false: false,
  null: null,
  true: true,
}

function tokenize(source: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]!
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (/\d/.test(char) || (char === '.' && /\d/.test(source[index + 1] ?? ''))) {
      const match = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(source.slice(index))!
      tokens.push({ position: index, type: 'number', value: match[0] })
      index += match[0].length
      continue
    }
    if (char === '"' || char === '\'') {
      let value = ''
      let cursor = index + 1
      while (cursor < source.length && source[cursor] !== char) {
        if (source[cursor] === '\\' && cursor + 1 < source.length) {
          const escaped = source[cursor + 1]!
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped
          cursor += 2
          continue
        }
        value += source[cursor]
        cursor += 1
      }
      if (cursor >= source.length)
        throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNTERMINATED_STRING', 'Unterminated string literal.', index)
      tokens.push({ position: index, type: 'string', value })
      index = cursor + 1
      continue
    }
    if (/[a-z_$]/i.test(char)) {
      const match = /^[a-z_$][\w$]*/i.exec(source.slice(index))!
      tokens.push({ position: index, type: 'identifier', value: match[0] })
      index += match[0].length
      continue
    }
    const operator = OPERATORS.find(candidate => source.startsWith(candidate, index))
    if (operator) {
      tokens.push({ position: index, type: 'operator', value: operator })
      index += operator.length
      continue
    }
    if (PUNCTUATION.has(char)) {
      tokens.push({ position: index, type: 'punctuation', value: char })
      index += 1
      continue
    }
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_CHARACTER', `Unexpected character "${char}".`, index)
  }
  return tokens
}

const BINARY_PRECEDENCE: Record<ConfigFormExpressionBinaryOperator, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '%': 6,
  '*': 6,
  '/': 6,
}

/**
 * Parses the safe expression language shared by flow conditions, reaction
 * operands, and formula fields. Supported grammar: literals, identifier
 * paths over the values scope, arrays, arithmetic/comparison/logical
 * operators, the ternary, and allow-listed function calls. No assignment,
 * no property writes, no arbitrary JavaScript.
 */
export function parseConfigFormExpression(source: string): ConfigFormExpressionNode {
  if (typeof source !== 'string' || source.trim().length === 0)
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_EMPTY', 'Expression source is empty.')
  if (source.length > CONFIG_FORM_EXPRESSION_MAX_LENGTH)
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_TOO_LONG', `Expression exceeds ${CONFIG_FORM_EXPRESSION_MAX_LENGTH} characters.`)

  const tokens = tokenize(source)
  let cursor = 0

  const peek = (): ExpressionToken | undefined => tokens[cursor]
  const next = (): ExpressionToken => {
    const token = tokens[cursor]
    if (!token)
      throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_END', 'Unexpected end of expression.', source.length)
    cursor += 1
    return token
  }
  const expect = (type: ExpressionToken['type'], value: string): void => {
    const token = tokens[cursor]
    if (!token)
      throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_END', `Expected "${value}" but the expression ended.`, source.length)
    cursor += 1
    if (token.type !== type || token.value !== value)
      throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_TOKEN', `Expected "${value}" but found "${token.value}".`, token.position)
  }

  function parseExpression(depth: number, minPrecedence = 0): ConfigFormExpressionNode {
    assertDepth(depth, peek()?.position)
    let left = parseUnary(depth + 1)
    while (true) {
      const token = peek()
      if (token?.type === 'operator' && token.value in BINARY_PRECEDENCE) {
        const operator = token.value as ConfigFormExpressionBinaryOperator
        const precedence = BINARY_PRECEDENCE[operator]
        if (precedence < minPrecedence)
          break
        next()
        const right = parseExpression(depth + 1, precedence + 1)
        left = { kind: 'binary', left, operator, right }
        continue
      }
      if (token?.type === 'punctuation' && token.value === '?' && minPrecedence === 0) {
        next()
        const consequent = parseExpression(depth + 1)
        expect('punctuation', ':')
        const alternate = parseExpression(depth + 1)
        left = { alternate, consequent, kind: 'conditional', test: left }
        continue
      }
      break
    }
    return left
  }

  function parseUnary(depth: number): ConfigFormExpressionNode {
    assertDepth(depth, peek()?.position)
    const token = peek()
    if (token?.type === 'operator' && (token.value === '-' || token.value === '+' || token.value === '!')) {
      next()
      return { kind: 'unary', operand: parseUnary(depth + 1), operator: token.value }
    }
    return parsePostfix(depth + 1)
  }

  function parsePostfix(depth: number): ConfigFormExpressionNode {
    let node = parsePrimary(depth + 1)
    while (true) {
      const token = peek()
      if (token?.type === 'punctuation' && token.value === '.') {
        next()
        const property = next()
        if (property.type !== 'identifier')
          throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_TOKEN', `Expected a property name but found "${property.value}".`, property.position)
        node = { kind: 'member', object: node, property: property.value }
        continue
      }
      if (token?.type === 'punctuation' && token.value === '[') {
        next()
        const index = parseExpression(depth + 1)
        expect('punctuation', ']')
        node = { index, kind: 'index', object: node }
        continue
      }
      break
    }
    return node
  }

  function parsePrimary(depth: number): ConfigFormExpressionNode {
    assertDepth(depth, peek()?.position)
    const token = next()
    if (token.type === 'number')
      return { kind: 'literal', value: Number(token.value) }
    if (token.type === 'string')
      return { kind: 'literal', value: token.value }
    if (token.type === 'identifier') {
      const lowered = token.value.toLowerCase()
      if (lowered in KEYWORD_LITERALS && (token.value === lowered || token.value === lowered.toUpperCase()))
        return { kind: 'literal', value: KEYWORD_LITERALS[lowered]! }
      if (peek()?.type === 'punctuation' && peek()?.value === '(') {
        next()
        const args: ConfigFormExpressionNode[] = []
        if (!(peek()?.type === 'punctuation' && peek()?.value === ')')) {
          args.push(parseExpression(depth + 1))
          while (peek()?.type === 'punctuation' && peek()?.value === ',') {
            next()
            args.push(parseExpression(depth + 1))
          }
        }
        expect('punctuation', ')')
        return { args, callee: token.value, kind: 'call' }
      }
      return { kind: 'identifier', name: token.value }
    }
    if (token.type === 'punctuation' && token.value === '(') {
      const node = parseExpression(depth + 1)
      expect('punctuation', ')')
      return node
    }
    if (token.type === 'punctuation' && token.value === '[') {
      const items: ConfigFormExpressionNode[] = []
      if (!(peek()?.type === 'punctuation' && peek()?.value === ']')) {
        items.push(parseExpression(depth + 1))
        while (peek()?.type === 'punctuation' && peek()?.value === ',') {
          next()
          items.push(parseExpression(depth + 1))
        }
      }
      expect('punctuation', ']')
      return { items, kind: 'array' }
    }
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_TOKEN', `Unexpected token "${token.value}".`, token.position)
  }

  function assertDepth(depth: number, position?: number): void {
    if (depth > CONFIG_FORM_EXPRESSION_MAX_DEPTH)
      throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_DEPTH_EXCEEDED', `Expression exceeds the maximum depth of ${CONFIG_FORM_EXPRESSION_MAX_DEPTH}.`, position)
  }

  const expression = parseExpression(0)
  const trailing = peek()
  if (trailing)
    throw new ConfigFormExpressionError('CONFIG_FORM_EXPRESSION_UNEXPECTED_TOKEN', `Unexpected token "${trailing.value}" after the expression.`, trailing.position)
  return expression
}
