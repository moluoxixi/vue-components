import type { ConfigFormField, ConfigFormRule, ConfigFormRules, ConfigFormValues } from '../../../ConfigForm'
import { resolveConfigFormCondition } from '../../../ConfigForm'

export type ShadcnFieldErrorMessages = string[]

/** 将字段级和表单级 rules 合并成 ShadcnConfigForm 自己可消费的线性规则列表。 */
export function collectShadcnFieldRules<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = unknown,
  TColProps = unknown,
>(
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>,
  formRules: ConfigFormRules<TValues>,
): ConfigFormRule[] {
  const fieldRules = normalizeRuleList(field.rules)
  const globalRules = normalizeRuleList(formRules[field.field])

  return [...globalRules, ...fieldRules]
}

/** 目前 Shadcn 版只接管必填错误展示，其它复杂校验仍建议由业务组件或提交前逻辑处理。 */
export function getShadcnFieldErrorMessages<
  TValues extends ConfigFormValues,
  TComponent = unknown,
  TFormItemProps = unknown,
  TColProps = unknown,
>(
  field: ConfigFormField<TValues, TComponent, TFormItemProps, TColProps>,
  rules: ConfigFormRule[],
  values: TValues,
): ShadcnFieldErrorMessages {
  const value = values[field.field]
  const messages: string[] = []

  if (resolveConfigFormCondition(field.required, values, false) && !hasRequiredValue(value))
    messages.push(`${field.label ?? field.field}不能为空`)

  rules.forEach((rule) => {
    if (rule.required && !hasRequiredValue(value))
      messages.push((rule.message as string | undefined) ?? `${field.label ?? field.field}不能为空`)
  })

  return messages
}

function normalizeRuleList(rule: ConfigFormRule | ConfigFormRule[] | undefined): ConfigFormRule[] {
  if (rule === undefined)
    return []

  return ([] as ConfigFormRule[]).concat(rule)
}

function hasRequiredValue(value: unknown): boolean {
  if (Array.isArray(value))
    return value.length > 0

  return value !== undefined && value !== null && value !== ''
}
