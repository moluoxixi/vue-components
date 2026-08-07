import type { RuleDescriptor, RuleSet } from './types'
import { z } from 'zod'
import { RuleCompileError, ruleDiagnostic } from './diagnostics'

function applyMessage<T extends { message?: string }>(
  options: T,
): { message?: string } {
  return options.message ? { message: options.message } : {}
}

function compileBase(ruleSet: RuleSet): z.ZodTypeAny {
  switch (ruleSet.base.type) {
    case 'string': return z.string()
    case 'number': return z.number()
    case 'boolean': return z.boolean()
    case 'date': return z.date()
    case 'enum': return z.enum(ruleSet.base.values)
    case 'literal': return z.literal(ruleSet.base.value)
  }
}

function compileRegex(rule: Extract<RuleDescriptor, { kind: 'regex' }>, ruleIndex: number): RegExp {
  try {
    return new RegExp(rule.source, rule.flags)
  }
  catch (error) {
    throw new RuleCompileError([ruleDiagnostic(
      'RULE_REGEX_INVALID',
      error instanceof Error ? error.message : 'Invalid regular expression',
      ['rules', ruleIndex],
      'error',
      ruleIndex,
    )])
  }
}

function compileDate(
  value: string,
  ruleIndex: number,
  kind: 'dateMin' | 'dateMax',
): Date {
  const date = new Date(value)
  if (!Number.isNaN(date.getTime()))
    return date

  throw new RuleCompileError([ruleDiagnostic(
    'RULE_DATE_INVALID',
    `${kind} requires a valid ISO date`,
    ['rules', ruleIndex],
    'error',
    ruleIndex,
  )])
}

function applyRule(schema: z.ZodTypeAny, rule: RuleDescriptor, ruleIndex: number): z.ZodTypeAny {
  switch (rule.kind) {
    case 'required':
      return schema
    case 'minLength':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'minLength requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.min(rule.value, applyMessage(rule))
    case 'maxLength':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'maxLength requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.max(rule.value, applyMessage(rule))
    case 'length':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'length requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.length(rule.value, applyMessage(rule))
    case 'regex':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'regex requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.regex(compileRegex(rule, ruleIndex), applyMessage(rule))
    case 'email':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'email requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.email(applyMessage(rule))
    case 'url':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'url requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.url(applyMessage(rule))
    case 'uuid':
      if (!(schema instanceof z.ZodString))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'uuid requires a string base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.uuid(applyMessage(rule))
    case 'min':
      if (schema instanceof z.ZodNumber) {
        return rule.inclusive === false
          ? schema.gt(rule.value, applyMessage(rule))
          : schema.gte(rule.value, applyMessage(rule))
      }
      throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'min requires a number base', ['rules', ruleIndex], 'error', ruleIndex)])
    case 'max':
      if (schema instanceof z.ZodNumber) {
        return rule.inclusive === false
          ? schema.lt(rule.value, applyMessage(rule))
          : schema.lte(rule.value, applyMessage(rule))
      }
      throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'max requires a number base', ['rules', ruleIndex], 'error', ruleIndex)])
    case 'integer':
      if (schema instanceof z.ZodNumber)
        return schema.int(applyMessage(rule))
      throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'integer requires a number base', ['rules', ruleIndex], 'error', ruleIndex)])
    case 'finite':
      if (schema instanceof z.ZodNumber)
        return schema.finite(applyMessage(rule))
      throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'finite requires a number base', ['rules', ruleIndex], 'error', ruleIndex)])
    case 'multipleOf':
      if (schema instanceof z.ZodNumber)
        return schema.multipleOf(rule.value, applyMessage(rule))
      throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'multipleOf requires a number base', ['rules', ruleIndex], 'error', ruleIndex)])
    case 'dateMin':
      if (!(schema instanceof z.ZodDate))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'dateMin requires a date base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.min(compileDate(rule.value, ruleIndex, rule.kind), applyMessage(rule))
    case 'dateMax':
      if (!(schema instanceof z.ZodDate))
        throw new RuleCompileError([ruleDiagnostic('RULE_TYPE_MISMATCH', 'dateMax requires a date base', ['rules', ruleIndex], 'error', ruleIndex)])
      return schema.max(compileDate(rule.value, ruleIndex, rule.kind), applyMessage(rule))
    case 'compare':
    case 'custom':
      return schema
  }
}

export function rulesToZod(ruleSet: RuleSet): z.ZodTypeAny {
  let schema = compileBase(ruleSet)
  let requiredRule: Extract<RuleDescriptor, { kind: 'required' }> | undefined
  for (const [ruleIndex, rule] of ruleSet.rules.entries()) {
    schema = applyRule(schema, rule, ruleIndex)
    if (rule.kind === 'required')
      requiredRule = rule
  }

  if (requiredRule && schema instanceof z.ZodString)
    schema = schema.refine(value => value.trim().length > 0, applyMessage(requiredRule))

  if (ruleSet.nullable)
    schema = schema.nullable()
  if (ruleSet.optional)
    schema = schema.optional()
  return schema
}
