import type { Component } from 'vue'
import type {
  ConfigFormAttrs,
  ConfigFormCondition,
  ConfigFormField,
  ConfigFormReadonlyRender,
  ConfigFormValues,
} from '../types'
import { resolveConfigFormCondition } from './node'

/** 表单级 readonly 会强制所有字段进入展示态，字段级 false 不覆盖它。 */
export function isConfigFormFieldReadonly<
  TValues extends ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  values: TValues,
  formReadonly?: ConfigFormCondition<TValues>,
): boolean {
  return resolveConfigFormCondition(formReadonly, values, false)
    || resolveConfigFormCondition(field.readonly, values, false)
}

/** 字段 render 优先于表单级 render；返回 undefined 表示使用内置原始值展示。 */
export function resolveConfigFormReadonlyRender<
  TValues extends ConfigFormValues,
  TComponent = Component | string,
  TFieldAttrs = ConfigFormAttrs,
  TCellAttrs = ConfigFormAttrs,
>(
  field: ConfigFormField<TValues, TComponent, TFieldAttrs, TCellAttrs>,
  formReadonlyRender?: ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs>,
): ConfigFormReadonlyRender<TValues, TComponent, TFieldAttrs, TCellAttrs> | undefined {
  return field.readonlyRender ?? formReadonlyRender
}

/** 未声明 readonlyRender 时使用的稳定文本格式化，不推断具体 UI 组件语义。 */
export function formatConfigFormReadonlyValue(value: unknown): string {
  if (value == null)
    return ''

  if (Array.isArray(value))
    return value.map(formatConfigFormReadonlyValue).join('、')

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
