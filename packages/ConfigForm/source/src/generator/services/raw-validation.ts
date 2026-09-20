import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { RuleBase, RuleDescriptor, RuleSet } from '@moluoxixi/zod3-to-rule'
import type { SourceValidationFieldEmission } from '../types/internal'
import { sourceJson, sourceString } from './serialization'

type SourceSurface = ProjectCompilation['ir']['surfacesById'][string]
type SourceFieldNode = Extract<SourceSurface['nodesById'][string], { kind: 'field' }>

function validatorIdentifier(value: string, fallback: string): string {
  const words = value.split(/[^a-z0-9]+/iu).filter(Boolean)
  const suffix = words.map(word => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join('')
  return `validate${suffix && /^[A-Z]/u.test(suffix) ? suffix : fallback}`
}

function uniqueValidatorNames(fields: readonly SourceFieldNode[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>()
  const used = new Set<string>()
  fields.forEach((field, index) => {
    const base = validatorIdentifier(field.id, `Field${index + 1}`)
    let name = base
    let suffix = 2
    while (used.has(name)) {
      name = `${base}${suffix}`
      suffix += 1
    }
    used.add(name)
    names.set(field.id, name)
  })
  return names
}

function baseMessage(label: string, base: RuleBase): string {
  switch (base.type) {
    case 'string': return `${label} must be a string.`
    case 'number': return `${label} must be a number.`
    case 'boolean': return `${label} must be true or false.`
    case 'date': return `${label} must be a valid date.`
    case 'enum': return `${label} must be one of the configured options.`
    case 'literal': return `${label} must equal the configured value.`
  }
}

function defaultRuleMessage(label: string, rule: RuleDescriptor): string {
  switch (rule.kind) {
    case 'minLength': return `${label} must contain at least ${rule.value} characters.`
    case 'maxLength': return `${label} must contain at most ${rule.value} characters.`
    case 'length': return `${label} must contain exactly ${rule.value} characters.`
    case 'regex': return `${label} has an invalid format.`
    case 'email': return `${label} must be a valid email address.`
    case 'url': return `${label} must be a valid URL.`
    case 'uuid': return `${label} must be a valid UUID.`
    case 'min': return `${label} must be ${rule.inclusive === false ? 'greater than' : 'at least'} ${rule.value}.`
    case 'max': return `${label} must be ${rule.inclusive === false ? 'less than' : 'at most'} ${rule.value}.`
    case 'integer': return `${label} must be an integer.`
    case 'finite': return `${label} must be finite.`
    case 'multipleOf': return `${label} must be a multiple of ${rule.value}.`
    case 'dateMin': return `${label} must be on or after ${rule.value}.`
    case 'dateMax': return `${label} must be on or before ${rule.value}.`
    case 'compare': return `${label} does not satisfy the comparison with ${rule.field}.`
    case 'custom': return `${label} uses an unsupported custom validator.`
  }
}

function message(label: string, rule: RuleDescriptor): string {
  return sourceString(rule.message ?? defaultRuleMessage(label, rule))
}

function baseValidationLines(label: string, ruleSet: RuleSet): string[] {
  const error = sourceString(baseMessage(label, ruleSet.base))
  const optional = ruleSet.optional === true
  const nullable = ruleSet.nullable === true
  const literalNull = ruleSet.base.type === 'literal' && ruleSet.base.value === null
  const lines = [
    '  let skipBaseRules = false',
    '  if (value === undefined) {',
    ...(optional ? ['    skipBaseRules = true'] : [`    return [${error}]`]),
    '  }',
    '  else if (value === null) {',
    ...((nullable || literalNull) ? ['    skipBaseRules = true'] : [`    return [${error}]`]),
    '  }',
  ]

  const base = ruleSet.base
  if (base.type === 'string')
    lines.push(`  else if (typeof value !== 'string') return [${error}]`)
  else if (base.type === 'number')
    lines.push(`  else if (typeof value !== 'number' || Number.isNaN(value)) return [${error}]`)
  else if (base.type === 'boolean')
    lines.push(`  else if (typeof value !== 'boolean') return [${error}]`)
  else if (base.type === 'date')
    lines.push(`  else if (demoDateTime(value) === undefined) return [${error}]`)
  else if (base.type === 'enum')
    lines.push(`  else if (typeof value !== 'string' || !${sourceJson(base.values, 0)}.includes(value)) return [${error}]`)
  else
    lines.push(`  else if (!Object.is(value, ${sourceJson(base.value, 0)})) return [${error}]`)
  return lines
}

function directRuleLines(label: string, rule: Exclude<RuleDescriptor, { kind: 'compare' | 'custom' }>): string[] {
  const error = message(label, rule)
  switch (rule.kind) {
    case 'minLength': return [`    if (typeof value === 'string' && value.length < ${rule.value}) errors.push(${error})`]
    case 'maxLength': return [`    if (typeof value === 'string' && value.length > ${rule.value}) errors.push(${error})`]
    case 'length': return [`    if (typeof value === 'string' && value.length !== ${rule.value}) errors.push(${error})`]
    case 'regex': return [`    if (typeof value === 'string' && !new RegExp(${sourceString(rule.source)}, ${sourceString(rule.flags ?? '')}).test(value)) errors.push(${error})`]
    case 'email': return [`    if (typeof value === 'string' && !/^(?!\\.)(?!.*\\.\\.)([A-Z0-9_'+\\-\\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\\-]*\\.)+[A-Z]{2,}$/i.test(value)) errors.push(${error})`]
    case 'url': return [`    if (typeof value === 'string' && !isDemoUrl(value)) errors.push(${error})`]
    case 'uuid': return [`    if (typeof value === 'string' && !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(value)) errors.push(${error})`]
    case 'min': return [`    if (typeof value === 'number' && !(value ${rule.inclusive === false ? '>' : '>='} ${sourceJson(rule.value, 0)})) errors.push(${error})`]
    case 'max': return [`    if (typeof value === 'number' && !(value ${rule.inclusive === false ? '<' : '<='} ${sourceJson(rule.value, 0)})) errors.push(${error})`]
    case 'integer': return [`    if (typeof value === 'number' && !Number.isInteger(value)) errors.push(${error})`]
    case 'finite': return [`    if (typeof value === 'number' && !Number.isFinite(value)) errors.push(${error})`]
    case 'multipleOf': return [`    if (typeof value === 'number' && !isDemoMultipleOf(value, ${sourceJson(rule.value, 0)})) errors.push(${error})`]
    case 'dateMin': return [`    if (demoDateTime(value)! < ${new Date(rule.value).getTime()}) errors.push(${error})`]
    case 'dateMax': return [`    if (demoDateTime(value)! > ${new Date(rule.value).getTime()}) errors.push(${error})`]
  }
}

function fieldValidatorSource(
  node: SourceFieldNode,
  validation: SourceValidationFieldEmission | undefined,
  functionName: string,
): string {
  const label = node.label ?? node.field
  const requiredMessage = node.requiredMessage ?? `${label} is required.`
  const lines = [
    `export function ${functionName}(`,
    '  value: unknown,',
    '  values: Readonly<Record<string, unknown>>,',
    `  required = ${node.required === true},`,
    '): string[] {',
    `  if (required && isDemoEmpty(value)) return [${sourceString(requiredMessage)}]`,
  ]
  if (!validation) {
    lines.push('  void values', '  return []', '}')
    return lines.join('\n')
  }

  lines.push(...baseValidationLines(label, validation.ruleSet), '  const errors: string[] = []', '  if (!skipBaseRules) {')
  for (const rule of validation.ruleSet.rules) {
    if (rule.kind === 'compare' || rule.kind === 'custom')
      continue
    lines.push(...directRuleLines(label, rule))
  }
  lines.push('  }', '  if (errors.length > 0) return errors')
  for (const rule of validation.ruleSet.rules) {
    if (rule.kind !== 'compare')
      continue
    lines.push(
      `  if (!compareDemoFieldValues(value, values[${sourceString(rule.field)}], ${sourceString(rule.operator)}, ${sourceString(validation.ruleSet.base.type)}))`,
      `    errors.push(${message(label, rule)})`,
    )
  }
  lines.push('  return errors', '}')
  return lines.join('\n')
}

const emptyHelper = `function isDemoEmpty(value: unknown): boolean {
  return value == null
    || (typeof value === 'string' && value.trim().length === 0)
    || (Array.isArray(value) && value.length === 0)
}`

const dateHelper = `function demoDateTime(value: unknown): number | undefined {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? undefined : value.getTime()
  if (typeof value !== 'string')
    return undefined
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? undefined : timestamp
}`

const urlHelper = `function isDemoUrl(value: string): boolean {
  try {
    void new URL(value)
    return true
  }
  catch {
    return false
  }
}`

const multipleOfHelper = `function decimalInteger(value: number): { coefficient: bigint, scale: number } | undefined {
  if (!Number.isFinite(value))
    return undefined
  const [mantissa, exponentText = '0'] = Math.abs(value).toString().toLowerCase().split('e')
  const [whole = '0', fraction = ''] = mantissa!.split('.')
  const exponent = Number(exponentText)
  const digits = BigInt(whole + fraction || '0')
  const scale = Math.max(0, fraction.length - exponent)
  const coefficient = digits * (10n ** BigInt(Math.max(0, exponent - fraction.length)))
  return { coefficient: value < 0 ? -coefficient : coefficient, scale }
}

function isDemoMultipleOf(value: number, divisor: number): boolean {
  const left = decimalInteger(value)
  const right = decimalInteger(divisor)
  if (!left || !right || right.coefficient === 0n)
    return false
  const scale = Math.max(left.scale, right.scale)
  const scaledLeft = left.coefficient * (10n ** BigInt(scale - left.scale))
  const scaledRight = right.coefficient * (10n ** BigInt(scale - right.scale))
  return scaledLeft % scaledRight === 0n
}`

const compareHelper = `function compareDemoFieldValues(
  value: unknown,
  other: unknown,
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte',
  base: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'literal',
): boolean {
  const left = base === 'date' ? demoDateTime(value) : value
  const right = base === 'date' ? demoDateTime(other) : other
  if (typeof left === 'number' && typeof right === 'number') {
    if (operator === 'eq') return Object.is(left, right)
    if (operator === 'neq') return !Object.is(left, right)
    if (operator === 'gt') return left > right
    if (operator === 'gte') return left >= right
    if (operator === 'lt') return left < right
    return left <= right
  }
  if (typeof left === 'string' && typeof right === 'string') {
    if (operator === 'eq') return Object.is(left, right)
    if (operator === 'neq') return !Object.is(left, right)
    if (operator === 'gt') return left > right
    if (operator === 'gte') return left >= right
    if (operator === 'lt') return left < right
    return left <= right
  }
  return false
}`

export function rawValidationModuleSource(
  surface: SourceSurface,
  validations: readonly SourceValidationFieldEmission[],
): string {
  const fields = Object.values(surface.nodesById)
    .filter((node): node is SourceFieldNode => node.kind === 'field')
    .sort((left, right) => left.id.localeCompare(right.id))
  const byNodeId = new Map(validations.map(validation => [validation.nodeId, validation]))
  const ruleSets = validations.map(validation => validation.ruleSet)
  const usesDate = ruleSets.some(ruleSet => ruleSet.base.type === 'date'
    || ruleSet.rules.some(rule => rule.kind === 'dateMin' || rule.kind === 'dateMax'))
  const usesUrl = ruleSets.some(ruleSet => ruleSet.rules.some(rule => rule.kind === 'url'))
  const usesMultipleOf = ruleSets.some(ruleSet => ruleSet.rules.some(rule => rule.kind === 'multipleOf'))
  const usesCompare = ruleSets.some(ruleSet => ruleSet.rules.some(rule => rule.kind === 'compare'))
  const helpers = [
    emptyHelper,
    ...(usesDate || usesCompare ? [dateHelper] : []),
    ...(usesUrl ? [urlHelper] : []),
    ...(usesMultipleOf ? [multipleOfHelper] : []),
    ...(usesCompare ? [compareHelper] : []),
  ]
  const names = uniqueValidatorNames(fields)
  const validators = fields.map(field => fieldValidatorSource(field, byNodeId.get(field.id), names.get(field.id)!))
  const entries = fields.map(field => `  ${sourceString(field.id)}: ${names.get(field.id)},`)
  return `${helpers.join('\n\n')}

export type DemoFieldValidator = (
  value: unknown,
  values: Readonly<Record<string, unknown>>,
  required?: boolean,
) => string[]

${validators.join('\n\n')}

export const demoFieldValidators: Readonly<Record<string, DemoFieldValidator>> = {
${entries.join('\n')}
}
`
}
