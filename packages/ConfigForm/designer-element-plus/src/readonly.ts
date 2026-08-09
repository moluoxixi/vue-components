import type { DesignerReadonlyRenderContext } from '@moluoxixi/config-form-designer'

export function renderElementPlusRawReadonly({ value }: DesignerReadonlyRenderContext): string {
  return formatReadonlyValue(value)
}

export function renderElementPlusChoiceReadonly({ componentProps, value }: DesignerReadonlyRenderContext): string {
  const options = readOptions(componentProps.options)
  if (Array.isArray(value))
    return value.map(item => resolveOptionLabel(options, item)).join('、')
  return resolveOptionLabel(options, value)
}

export function renderElementPlusSwitchReadonly({ componentProps, value }: DesignerReadonlyRenderContext): string {
  const activeValue = Object.hasOwn(componentProps, 'activeValue') ? componentProps.activeValue : true
  const inactiveValue = Object.hasOwn(componentProps, 'inactiveValue') ? componentProps.inactiveValue : false
  if (Object.is(value, activeValue))
    return formatReadonlyValue(componentProps.activeText ?? value)
  if (Object.is(value, inactiveValue))
    return formatReadonlyValue(componentProps.inactiveText ?? value)
  return formatReadonlyValue(value)
}

interface ReadonlyOption {
  label?: unknown
  value?: unknown
}

function readOptions(value: unknown): ReadonlyOption[] {
  return Array.isArray(value)
    ? value.filter((option): option is ReadonlyOption => typeof option === 'object' && option !== null)
    : []
}

function resolveOptionLabel(options: ReadonlyOption[], value: unknown): string {
  const option = options.find(candidate => Object.is(candidate.value, value))
  return formatReadonlyValue(option?.label ?? value)
}

function formatReadonlyValue(value: unknown): string {
  if (value == null)
    return ''
  if (Array.isArray(value))
    return value.map(formatReadonlyValue).join('、')
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}
