import type {
  CompiledRuleSet,
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
): boolean {
  switch (operator) {
    case 'eq': return value === other
    case 'neq': return value !== other
    case 'gt': return typeof value === 'number' && typeof other === 'number' && value > other
    case 'gte': return typeof value === 'number' && typeof other === 'number' && value >= other
    case 'lt': return typeof value === 'number' && typeof other === 'number' && value < other
    case 'lte': return typeof value === 'number' && typeof other === 'number' && value <= other
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
      validators.push((value, values) => compareValues(value, values[rule.field], rule.operator)
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
