import type { ZodIssue, ZodTypeAny } from 'zod'
import type { FieldCondition, FieldConfig, FieldValidator, FormErrors, FormValues, NormalizedFieldConfig, ValidateTrigger } from '@/types'
import { applyFieldDefaults } from '@/plugins/builtInFieldDefaults'
import { shouldValidateOn } from '@/utils/field'

/** 校验单个字段值（纯 Zod 调用）。 */
export function validateField(
  value: unknown,
  schema: ZodTypeAny,
  _allValues?: FormValues,
): string[] {
  const result = schema.safeParse(value)
  if (result.success)
    return []
  return formatZodIssues(result.error.issues)
}

/** 将 Zod issue 转换为 ConfigForm 对外暴露的字符串错误列表。 */
function formatZodIssues(issues: ZodIssue[]): string[] {
  return issues.map(issue => issue.message || `Validation failed: ${issue.path.join('.')}`)
}

/**
 * 归一化自定义 validator 的返回值。
 *
 * falsy 值表示校验通过；数组会过滤空消息，字符串会作为单条错误消息返回。
 */
function normalizeValidatorResult(result: Awaited<ReturnType<FieldValidator>>): string[] {
  if (!result)
    return []
  return Array.isArray(result) ? result.filter(Boolean) : [result]
}

/**
 * 校验单个字段，包含 Zod schema 和可访问全量 values 的自定义 validator。
 */
export async function validateFieldRules(
  value: unknown,
  schema: ZodTypeAny | undefined,
  allValues: FormValues,
  validator?: FieldValidator,
): Promise<string[]> {
  let validatorValue = value
  if (schema) {
    const result = schema.safeParse(value)
    if (!result.success)
      return formatZodIssues(result.error.issues)
    validatorValue = result.data
  }

  const customErrors = validator
    ? normalizeValidatorResult(await validator(validatorValue, allValues))
    : []
  return customErrors
}

/**
 * 校验整个表单（按触发时机过滤）。
 * 跳过逻辑由 runtime 统一判断，此处只做遍历。
 */
export async function validateForm(
  values: FormValues,
  fields: FieldConfig[],
  trigger: ValidateTrigger = 'submit',
): Promise<FormErrors> {
  const errors: FormErrors = {}
  for (const config of fields) {
    const field = applyFieldDefaults(config) as NormalizedFieldConfig
    if (!field.schema && !field.validator)
      continue
    const shouldValidateHidden = trigger === 'submit' && field.submitWhenHidden
    const shouldValidateDisabled = trigger === 'submit' && field.submitWhenDisabled

    if (!resolveCondition(field.visible, values, true) && !shouldValidateHidden)
      continue
    if (resolveCondition(field.disabled, values, false) && !shouldValidateDisabled)
      continue
    if (!shouldValidateOn(field, trigger))
      continue

    const errs = await validateFieldRules(values[field.field], field.schema, values, field.validator)
    if (errs.length > 0)
      errors[field.field] = errs
  }
  return errors
}

/** 解析字段显隐/禁用条件；函数条件的异常按原语义向调用方抛出。 */
function resolveCondition(
  condition: FieldCondition | undefined,
  values: FormValues,
  defaultValue: boolean,
): boolean {
  if (condition == null)
    return defaultValue
  if (typeof condition === 'boolean')
    return condition
  return condition(values)
}
