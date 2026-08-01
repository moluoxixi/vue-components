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
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>,
  values: TValues,
  formReadonly?: ConfigFormCondition<TValues>,
): boolean {
  return resolveConfigFormCondition(formReadonly, values, false)
    || resolveConfigFormCondition(field.readonly, values, false)
}

/** 字段 render 优先于表单 fallback；返回 undefined 表示使用原始值展示。 */
export function resolveConfigFormReadonlyRender<
  TValues extends ConfigFormValues,
  TComponent = Component | string,
  TFormItemProps = ConfigFormAttrs,
  TColProps = ConfigFormAttrs,
>(
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>,
  fallback?: ConfigFormReadonlyRender<TValues, TComponent, TFormItemProps, TColProps>,
): ConfigFormReadonlyRender<TValues, TComponent, TFormItemProps, TColProps> | undefined {
  return field.readonlyRender ?? fallback
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
