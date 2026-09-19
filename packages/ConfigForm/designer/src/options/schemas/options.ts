import type { DesignerOption } from '../types'

export function normalizeDesignerOptions(
  options: readonly unknown[] | undefined,
): DesignerOption[] {
  if (!options)
    return []
  return options.flatMap((option) => {
    if (!isRecord(option) || typeof option.label !== 'string' || !isDesignerOptionValue(option.value))
      return []
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
