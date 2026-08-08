import type {
  CompiledRuleSet,
  RuleBase,
  RuleCompileContext,
  RuleDescriptor,
  RuleSet,
  RuleValidator,
} from './types'
import { ruleDiagnostic } from './diagnostics'
import { rulesToZod } from './to-zod'

function normalizeResult(result: Awaited<ReturnType<RuleValidator>>): string[] {
  if (!result)
    return []
  return Array.isArray(result) ? result.filter(Boolean) : [result]
}

function compareValues(
  value: unknown,
  other: unknown,
  operator: Extract<RuleDescriptor, { kind: 'compare' }>['operator'],
  baseType: RuleBase['type'],
): boolean {
  const comparable = (input: unknown): { kind: 'date' | 'number' | 'string', value: number | string } | undefined => {
    if (input instanceof Date)
      return Number.isNaN(input.getTime()) ? undefined : { kind: 'date', value: input.getTime() }
    if (baseType === 'date' && typeof input === 'string') {
      const date = new Date(input)
      return Number.isNaN(date.getTime()) ? undefined : { kind: 'date', value: date.getTime() }
    }
    if (typeof input === 'number' || typeof input === 'string')
      return { kind: typeof input === 'number' ? 'number' : 'string', value: input }
    return undefined
  }

  const left = comparable(value)
  const right = comparable(other)

  if (!left || !right || left.kind !== right.kind)
    return false

  switch (operator) {
    case 'eq': return Object.is(left.value, right.value)
    case 'neq': return !Object.is(left.value, right.value)
    case 'gt': return left.value > right.value
    case 'gte': return left.value >= right.value
    case 'lt': return left.value < right.value
    case 'lte': return left.value <= right.value
  }
}

export function compileRules(
  ruleSet: RuleSet,
  context: RuleCompileContext = {},
): CompiledRuleSet {
  const diagnostics = [] as CompiledRuleSet['diagnostics']
  const validators: RuleValidator[] = []
  let required: boolean | undefined
  let requiredMessage: string | undefined

  for (const [ruleIndex, rule] of ruleSet.rules.entries()) {
    if (rule.kind === 'required') {
      required = true
      requiredMessage = rule.message
      continue
    }

    if (rule.kind === 'compare') {
      validators.push((value, values) => compareValues(value, values[rule.field], rule.operator, ruleSet.base.type)
        ? undefined
        : rule.message ?? `字段 ${rule.field} 比较失败`)
      continue
    }

    if (rule.kind === 'custom') {
      const validator = context.custom?.[rule.key]
      if (!validator) {
        diagnostics.push(ruleDiagnostic(
          'RULE_CUSTOM_VALIDATOR_MISSING',
          `Custom validator not registered: ${rule.key}`,
          ['rules', ruleIndex],
          'error',
          ruleIndex,
        ))
        continue
      }
      validators.push((value, values) => validator(value, values, rule.params))
    }
  }

  if (ruleSet.optional && required) {
    diagnostics.push(ruleDiagnostic(
      'RULE_OPTIONAL_REQUIRED_CONFLICT',
      'A rule set cannot be both optional and required',
      ['optional'],
    ))
  }

  const schema = rulesToZod(ruleSet)
  const validator = validators.length === 0
    ? undefined
    : async (value: unknown, values: Record<string, unknown>) => {
      const errors: string[] = []
      for (const validate of validators)
        errors.push(...normalizeResult(await validate(value, values)))
      return errors
    }

  return { schema, required, requiredMessage, validator, diagnostics }
}
