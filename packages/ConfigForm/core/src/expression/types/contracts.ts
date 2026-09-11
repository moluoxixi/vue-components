import type { ConfigFormJsonValue } from '../../json'

export type ConfigFormExpressionBinaryOperator
  = | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | '=='
    | '!='
    | '>'
    | '>='
    | '<'
    | '<='
    | '&&'
    | '||'

export type ConfigFormExpressionUnaryOperator = '-' | '+' | '!'

/** Serializable expression AST; parse once, evaluate per values snapshot. */
export type ConfigFormExpressionNode
  = | { kind: 'literal', value: ConfigFormJsonValue }
    | { kind: 'identifier', name: string }
    | { kind: 'member', object: ConfigFormExpressionNode, property: string }
    | { kind: 'index', object: ConfigFormExpressionNode, index: ConfigFormExpressionNode }
    | { kind: 'array', items: ConfigFormExpressionNode[] }
    | { kind: 'unary', operator: ConfigFormExpressionUnaryOperator, operand: ConfigFormExpressionNode }
    | {
      kind: 'binary'
      operator: ConfigFormExpressionBinaryOperator
      left: ConfigFormExpressionNode
      right: ConfigFormExpressionNode
    }
    | {
      kind: 'conditional'
      test: ConfigFormExpressionNode
      consequent: ConfigFormExpressionNode
      alternate: ConfigFormExpressionNode
    }
    | { kind: 'call', callee: string, args: ConfigFormExpressionNode[] }

export type ConfigFormExpressionFunction = (...args: unknown[]) => unknown

export interface ConfigFormExpressionEvaluateOptions {
  /** Extra allow-listed functions merged over the built-in library. */
  functions?: Record<string, ConfigFormExpressionFunction>
}

export interface ConfigFormExpressionDiagnostic {
  code: string
  message: string
  /** 0-based character offset in the expression source when known. */
  position?: number
}

export type ConfigFormExpressionResult
  = | { success: true, value: unknown }
    | { success: false, diagnostic: ConfigFormExpressionDiagnostic }
