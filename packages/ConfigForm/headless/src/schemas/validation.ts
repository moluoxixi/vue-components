import type { ZodIssue, ZodTypeAny } from 'zod'
import type {
  ConfigFormCondition,
  ConfigFormFieldRuleIssue,
  ConfigFormFieldValidator,
  ConfigFormFieldValidatorContext,
  ConfigFormValidateTrigger,
  ConfigFormValues,
} from '../types'
import { normalizeConfigFormValidateOn } from '@moluoxixi/config-form-core'
import { resolveConfigFormCondition } from '../utils'

/** 规范化校验触发配置；submit 始终启用，避免交互配置绕过提交校验。 */
export { normalizeConfigFormValidateOn }

export function shouldValidateConfigFormOn(
  validateOn: ConfigFormValidateTrigger | ConfigFormValidateTrigger[] | undefined,
  trigger: ConfigFormValidateTrigger,
): boolean {
  return normalizeConfigFormValidateOn(validateOn).includes(trigger)
}

/** 必填只拦截真实空值，0、false 和非空数组均是有效输入。 */
export function isEmptyConfigFormRequiredValue(value: unknown): boolean {
  if (value == null)
    return true
  if (typeof value === 'string')
    return value.trim().length === 0
  if (Array.isArray(value))
    return value.length === 0
  return false
}

export function formatConfigFormZodIssues(issues: ZodIssue[]): string[] {
  return issues.map(issue => issue.message || `Validation failed: ${issue.path.join('.')}`)
}

function normalizeValidatorResult(
  result: Awaited<ReturnType<ConfigFormFieldValidator>>,
): string[] {
  if (!result)
    return []
  return Array.isArray(result) ? result.filter(Boolean) : [result]
}

/** 依次执行 required、Zod 和业务 validator，并统一返回结构化错误。 */
export async function validateConfigFormFieldRuleIssues<
  TValues extends ConfigFormValues,
>(
  value: unknown,
  values: TValues,
  options: {
    required?: ConfigFormCondition<TValues>
    requiredMessage?: string
    schema?: ZodTypeAny
    validator?: ConfigFormFieldValidator<TValues>
  },
  context: ConfigFormFieldValidatorContext,
): Promise<ConfigFormFieldRuleIssue[]> {
  context.signal.throwIfAborted()
  if (
    resolveConfigFormCondition(options.required, values, false)
    && isEmptyConfigFormRequiredValue(value)
  ) {
    return [{ code: 'required', message: options.requiredMessage ?? '必填' }]
  }

  let validatorValue = value
  if (options.schema) {
    const result = await options.schema.safeParseAsync(value)
    if (!result.success) {
      return result.error.issues.map(issue => ({
        code: issue.code,
        message: issue.message || `Validation failed: ${issue.path.join('.')}`,
      }))
    }
    validatorValue = result.data
    context.signal.throwIfAborted()
  }

  if (!options.validator)
    return []
  const result = await options.validator(validatorValue, values, context)
  context.signal.throwIfAborted()
  return normalizeValidatorResult(result).map(message => ({ code: 'custom', message }))
}

/** Message-only projection for standalone rule consumers. */
export async function validateConfigFormFieldRules<
  TValues extends ConfigFormValues,
>(
  value: unknown,
  values: TValues,
  options: {
    required?: ConfigFormCondition<TValues>
    requiredMessage?: string
    schema?: ZodTypeAny
    validator?: ConfigFormFieldValidator<TValues>
  },
  signal = new AbortController().signal,
): Promise<string[]> {
  const issues = await validateConfigFormFieldRuleIssues(value, values, options, { signal })
  return issues.map(issue => issue.message)
}
