import type { DesignerReadonlyRenderContext } from '@moluoxixi/config-form-designer'
import type { VNodeChild } from 'vue'
import { h } from 'vue'
import AntdChoiceReadonlyContent from './components/AntdChoiceReadonlyContent.vue'
import { normalizeAntdVueOptions, readAntdVueOptionSource } from './options'

export function renderAntdVueRawReadonly({ value }: DesignerReadonlyRenderContext): string {
  return formatReadonlyValue(value)
}

export function renderAntdVuePasswordReadonly({ value }: DesignerReadonlyRenderContext): string {
  return value == null || value === '' ? '' : '********'
}

export function renderAntdVueChoiceReadonly({ componentProps, value }: DesignerReadonlyRenderContext): VNodeChild {
  const options = normalizeAntdVueOptions(Array.isArray(componentProps.options) ? componentProps.options : undefined)
  const optionSource = readAntdVueOptionSource(componentProps.optionSource)
  if (optionSource)
    return h(AntdChoiceReadonlyContent, { value, options, optionSource })
  if (Array.isArray(value))
    return value.map(item => resolveOptionLabel(options, item)).join('、')
  return resolveOptionLabel(options, value)
}

export function renderAntdVueSwitchReadonly({ componentProps, value }: DesignerReadonlyRenderContext): string {
  const checkedValue = Object.hasOwn(componentProps, 'checkedValue') ? componentProps.checkedValue : true
  const unCheckedValue = Object.hasOwn(componentProps, 'unCheckedValue') ? componentProps.unCheckedValue : false
  if (Object.is(value, checkedValue))
    return formatReadonlyValue(componentProps.checkedChildren ?? value)
  if (Object.is(value, unCheckedValue))
    return formatReadonlyValue(componentProps.unCheckedChildren ?? value)
  return formatReadonlyValue(value)
}

interface ReadonlyOption {
  label?: unknown
  value?: unknown
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
