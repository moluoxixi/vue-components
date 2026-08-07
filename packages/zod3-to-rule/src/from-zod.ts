import type { RuleDescriptor, RuleSet, ZodToRulesResult } from './types'
import { z } from 'zod'
import { RULE_SET_VERSION } from './constants'
import { ruleDiagnostic } from './diagnostics'

function messageFromCheck(check: { message?: string }): string | undefined {
  return typeof check.message === 'string' ? check.message : undefined
}

function withMessage<T extends RuleDescriptor>(rule: T, check: { message?: string }): T {
  const message = messageFromCheck(check)
  return message ? { ...rule, message } as T : rule
}

function unsupported(message: string, path: (string | number)[] = []): ReturnType<typeof ruleDiagnostic> {
  return ruleDiagnostic('ZOD_UNSUPPORTED', message, path, 'warning')
}

function unwrapSchema(schema: z.ZodTypeAny): {
  schema: z.ZodTypeAny
  optional: boolean
  nullable: boolean
  unsupported: boolean
  diagnostics: ReturnType<typeof ruleDiagnostic>[]
} {
  let current = schema
  let optional = false
  let nullable = false
  const diagnostics: ReturnType<typeof ruleDiagnostic>[] = []

  while (true) {
    if (current instanceof z.ZodOptional) {
      optional = true
      current = current.unwrap()
      continue
    }
    if (current instanceof z.ZodNullable) {
      nullable = true
      current = current.unwrap()
      continue
    }
    if (current instanceof z.ZodDefault) {
      diagnostics.push(unsupported('Zod default values are not part of the rule format'))
      current = current.removeDefault()
      continue
    }
    if (current instanceof z.ZodEffects) {
      diagnostics.push(unsupported('Zod effects/refine/transform cannot be represented as rules'))
      return { schema: current, optional, nullable, unsupported: true, diagnostics }
    }
    break
  }

  return { schema: current, optional, nullable, unsupported: false, diagnostics }
}

function exportString(schema: z.ZodString): { rules: RuleDescriptor[], diagnostics: ReturnType<typeof ruleDiagnostic>[] } {
  const rules: RuleDescriptor[] = []
  const diagnostics: ReturnType<typeof ruleDiagnostic>[] = []
  const checks = schema._def.checks
  for (const check of checks) {
    const kind = check.kind
    switch (kind) {
      case 'min':
        rules.push(withMessage({ kind: 'minLength', value: check.value }, check))
        break
      case 'max':
        rules.push(withMessage({ kind: 'maxLength', value: check.value }, check))
        break
      case 'length':
        rules.push(withMessage({ kind: 'length', value: check.value }, check))
        break
      case 'email':
        rules.push(withMessage({ kind: 'email' }, check))
        break
      case 'url':
        rules.push(withMessage({ kind: 'url' }, check))
        break
      case 'uuid':
        rules.push(withMessage({ kind: 'uuid' }, check))
        break
      case 'regex': {
        const regex = check.regex
        if (regex instanceof RegExp)
          rules.push(withMessage({ kind: 'regex', source: regex.source, flags: regex.flags }, check))
        else
          diagnostics.push(unsupported('Zod regex check does not contain a RegExp'))
        break
      }
      default:
        diagnostics.push(unsupported(`Zod string check is not supported: ${String(kind)}`))
    }
  }
  return { rules, diagnostics }
}

function exportNumber(schema: z.ZodNumber): { rules: RuleDescriptor[], diagnostics: ReturnType<typeof ruleDiagnostic>[] } {
  const rules: RuleDescriptor[] = []
  const diagnostics: ReturnType<typeof ruleDiagnostic>[] = []
  const checks = schema._def.checks
  for (const check of checks) {
    const kind = check.kind
    switch (kind) {
      case 'min':
        rules.push(withMessage({ kind: 'min', value: check.value, inclusive: check.inclusive }, check))
        break
      case 'max':
        rules.push(withMessage({ kind: 'max', value: check.value, inclusive: check.inclusive }, check))
        break
      case 'int':
        rules.push(withMessage({ kind: 'integer' }, check))
        break
      case 'finite':
        rules.push(withMessage({ kind: 'finite' }, check))
        break
      case 'multipleOf':
        rules.push(withMessage({ kind: 'multipleOf', value: check.value }, check))
        break
      default:
        diagnostics.push(unsupported(`Zod number check is not supported: ${String(kind)}`))
    }
  }
  return { rules, diagnostics }
}

function exportDate(schema: z.ZodDate): { rules: RuleDescriptor[], diagnostics: ReturnType<typeof ruleDiagnostic>[] } {
  const rules: RuleDescriptor[] = []
  const diagnostics: ReturnType<typeof ruleDiagnostic>[] = []
  const checks = schema._def.checks
  for (const check of checks) {
    const value = new Date(check.value)
    if (Number.isNaN(value.getTime())) {
      diagnostics.push(unsupported('Zod date check does not contain a valid date value'))
      continue
    }
    if (check.kind === 'min')
      rules.push(withMessage({ kind: 'dateMin', value: value.toISOString() }, check))
    else
      rules.push(withMessage({ kind: 'dateMax', value: value.toISOString() }, check))
  }
  return { rules, diagnostics }
}

export function zodToRules(schema: z.ZodTypeAny): ZodToRulesResult {
  const unwrapped = unwrapSchema(schema)
  const diagnostics = [...unwrapped.diagnostics]
  if (unwrapped.unsupported)
    return { diagnostics }

  if (
    (unwrapped.schema instanceof z.ZodString
      || unwrapped.schema instanceof z.ZodNumber
      || unwrapped.schema instanceof z.ZodBoolean
      || unwrapped.schema instanceof z.ZodDate)
    && unwrapped.schema._def.coerce
  ) {
    diagnostics.push(unsupported('Zod coercion cannot be represented as rules'))
    return { diagnostics }
  }

  let base: RuleSet['base']
  let rules: RuleDescriptor[] = []

  if (unwrapped.schema instanceof z.ZodString) {
    base = { type: 'string' }
    const exported = exportString(unwrapped.schema)
    rules = exported.rules
    diagnostics.push(...exported.diagnostics)
  }
  else if (unwrapped.schema instanceof z.ZodNumber) {
    base = { type: 'number' }
    const exported = exportNumber(unwrapped.schema)
    rules = exported.rules
    diagnostics.push(...exported.diagnostics)
  }
  else if (unwrapped.schema instanceof z.ZodBoolean) {
    base = { type: 'boolean' }
  }
  else if (unwrapped.schema instanceof z.ZodDate) {
    base = { type: 'date' }
    const exported = exportDate(unwrapped.schema)
    rules = exported.rules
    diagnostics.push(...exported.diagnostics)
  }
  else if (unwrapped.schema instanceof z.ZodEnum) {
    const values = unwrapped.schema.options
    base = { type: 'enum', values: values as [string, ...string[]] }
  }
  else if (unwrapped.schema instanceof z.ZodLiteral) {
    const value = unwrapped.schema.value
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && value !== null) {
      diagnostics.push(unsupported('Zod literal value is not JSON-safe'))
      return { diagnostics }
    }
    base = { type: 'literal', value }
  }
  else {
    const definition = unwrapped.schema._def as unknown as { typeName?: unknown }
    diagnostics.push(unsupported(`Zod schema type is not supported: ${String(definition.typeName ?? 'unknown')}`))
    return { diagnostics }
  }

  return {
    ruleSet: {
      version: RULE_SET_VERSION,
      base,
      rules,
      ...(unwrapped.optional ? { optional: true } : {}),
      ...(unwrapped.nullable ? { nullable: true } : {}),
    },
    diagnostics,
  }
}
