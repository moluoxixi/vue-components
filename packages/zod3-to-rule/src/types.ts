import type { RULE_SET_VERSION } from './constants'

export type RulePrimitive = string | number | boolean | null

export type RuleJsonValue
  = | RulePrimitive
    | RuleJsonValue[]
    | { [key: string]: RuleJsonValue }

export type RuleBase
  = | { type: 'string' }
    | { type: 'number' }
    | { type: 'boolean' }
    | { type: 'date' }
    | { type: 'enum', values: [string, ...string[]] }
    | { type: 'literal', value: RulePrimitive }

export type RuleDescriptor
  = | { kind: 'required', message?: string }
    | { kind: 'minLength', value: number, message?: string }
    | { kind: 'maxLength', value: number, message?: string }
    | { kind: 'length', value: number, message?: string }
    | { kind: 'regex', source: string, flags?: string, message?: string }
    | { kind: 'email', message?: string }
    | { kind: 'url', message?: string }
    | { kind: 'uuid', message?: string }
    | { kind: 'min', value: number, inclusive?: boolean, message?: string }
    | { kind: 'max', value: number, inclusive?: boolean, message?: string }
    | { kind: 'integer', message?: string }
    | { kind: 'finite', message?: string }
    | { kind: 'multipleOf', value: number, message?: string }
    | { kind: 'dateMin', value: string, message?: string }
    | { kind: 'dateMax', value: string, message?: string }
    | {
      kind: 'compare'
      field: string
      operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
      message?: string
    }
    | { kind: 'custom', key: string, params?: RuleJsonValue, message?: string }

export interface RuleSet {
  version: typeof RULE_SET_VERSION
  base: RuleBase
  rules: RuleDescriptor[]
  optional?: boolean
  nullable?: boolean
}

export type RuleDiagnosticSeverity = 'error' | 'warning'

export interface RuleDiagnostic {
  code: string
  severity: RuleDiagnosticSeverity
  path: (string | number)[]
  message: string
  ruleIndex?: number
}

export type RuleValidationResult = string | string[] | void | null | undefined

export type RuleValidator = (
  value: unknown,
  values: Record<string, unknown>,
) => RuleValidationResult | Promise<RuleValidationResult>

export type RuleCustomValidator = (
  value: unknown,
  values: Record<string, unknown>,
  params: RuleJsonValue | undefined,
) => RuleValidationResult | Promise<RuleValidationResult>

export interface RuleCompileContext {
  custom?: Record<string, RuleCustomValidator>
}

export interface CompiledRuleSet {
  schema: import('zod').ZodTypeAny
  required?: boolean
  requiredMessage?: string
  validator?: RuleValidator
  diagnostics: RuleDiagnostic[]
}

export interface RuleParseSuccess {
  success: true
  data: RuleSet
  diagnostics: []
}

export interface RuleParseFailure {
  success: false
  data?: undefined
  diagnostics: RuleDiagnostic[]
}

export type RuleParseResult = RuleParseSuccess | RuleParseFailure

export interface ZodToRulesResult {
  ruleSet?: RuleSet
  diagnostics: RuleDiagnostic[]
}
