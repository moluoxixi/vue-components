import type { RuleBase, RulePrimitive } from '@moluoxixi/zod3-to-rule'
import type { DesignerOption } from '../types'

export function createDesignerOptionKey(
  value: DesignerOption['value'],
  index: number,
): string {
  return `${typeof value}:${String(value)}:${index}`
}

export function resolveDesignerOptionValidationBase(options: unknown): RuleBase | undefined {
  if (!Array.isArray(options) || options.length === 0)
    return undefined
  const values: RulePrimitive[] = []
  for (const option of options) {
    if (!isRecord(option) || !isRulePrimitive(option.value))
      return undefined
    values.push(option.value)
  }
  if (new Set(values.map(primitiveIdentity)).size !== values.length)
    return undefined
  if (values.every((value): value is string => typeof value === 'string'))
    return { type: 'enum', values: values as [string, ...string[]] }
  return values.length === 1 ? { type: 'literal', value: values[0]! } : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRulePrimitive(value: unknown): value is RulePrimitive {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}

function primitiveIdentity(value: RulePrimitive): string {
  return `${typeof value}:${String(value)}`
}
