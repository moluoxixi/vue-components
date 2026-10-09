import type { ModelJsonObject, SafeExpression } from '@moluoxixi/config-form-model'
import { evaluateSafeExpression } from '@moluoxixi/config-form-prototype-runtime/session'

/** Use the exact evaluator used by Experience; no editor-specific interpreter. */
export function evaluateStudioExpression(expression: SafeExpression, sample: ModelJsonObject) {
  const object = (value: unknown): ModelJsonObject =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as ModelJsonObject) : {}
  const values = object(sample.values)
  const result = evaluateSafeExpression(expression, {
    values,
    parameters: object(sample.parameters),
    item: object(sample.item),
    result: sample.result,
    scopeValues: { current: values, parent: object(sample.parentValues), root: object(sample.rootValues ?? values) },
  })
  return result.success ? result : { success: false as const, message: result.diagnostic.message }
}
