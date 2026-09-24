import type { RuleBase } from '@moluoxixi/zod3-to-rule'
import type { DesignerDefaultValueKind, DesignerSetterOption } from '../../../registry'
import type { DesignerEditableRuleKind } from '../types'
import { resolveDesignerOptionValidationBase } from '../../../options'

const STRING_RULE_KINDS = [
  'minLength',
  'maxLength',
  'length',
  'regex',
  'email',
  'url',
  'uuid',
] as const satisfies readonly DesignerEditableRuleKind[]

const NUMBER_RULE_KINDS = [
  'min',
  'max',
  'integer',
  'finite',
  'multipleOf',
] as const satisfies readonly DesignerEditableRuleKind[]

const DATE_RULE_KINDS = [
  'dateMin',
  'dateMax',
] as const satisfies readonly DesignerEditableRuleKind[]

export function resolveDesignerValidationBase(
  valueKind: DesignerDefaultValueKind | undefined,
  options: readonly DesignerSetterOption[] | undefined,
): RuleBase | undefined {
  if (valueKind === 'text')
    return { type: 'string' }
  if (valueKind === 'number')
    return { type: 'number' }
  if (valueKind === 'boolean')
    return { type: 'boolean' }
  if (valueKind === 'date')
    return { type: 'date' }
  return valueKind === 'select'
    ? resolveDesignerOptionValidationBase(options)
    : undefined
}

export function resolveDesignerValidationRuleKinds(
  base: RuleBase | undefined,
): readonly DesignerEditableRuleKind[] {
  if (base?.type === 'string')
    return STRING_RULE_KINDS
  if (base?.type === 'number')
    return NUMBER_RULE_KINDS
  if (base?.type === 'date')
    return DATE_RULE_KINDS
  return []
}
