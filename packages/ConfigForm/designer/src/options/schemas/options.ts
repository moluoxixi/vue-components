import type { DesignerOptionValueType } from '../../registry'
import type { DesignerOption } from '../types'
import { DESIGNER_OPTION_VALUE_TYPES } from '../constants'

export function normalizeDesignerOptions(
  options: readonly unknown[] | undefined,
  allowedValueTypes: readonly DesignerOptionValueType[] = DESIGNER_OPTION_VALUE_TYPES,
): DesignerOption[] {
  if (!options)
    return []
  const allowedTypes = new Set<DesignerOptionValueType>(allowedValueTypes)
  return options.flatMap((option) => {
    if (!isRecord(option)
      || typeof option.label !== 'string'
      || !isDesignerOptionValue(option.value)
      || !allowedTypes.has(typeof option.value as DesignerOptionValueType)) {
      return []
    }
    return [{
      label: option.label,
      value: option.value,
      ...(typeof option.disabled === 'boolean' ? { disabled: option.disabled } : {}),
    }]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDesignerOptionValue(value: unknown): value is DesignerOption['value'] {
  return typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}
