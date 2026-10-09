import type { ModelJsonObject, ModelJsonValue, SafeExpression } from '@moluoxixi/config-form-model'

/** Host-supplied evaluator keeps Designer independent of Prototype Runtime. */
export type DesignerExpressionEvaluator = (
  expression: SafeExpression,
  sample: ModelJsonObject,
) => { success: true, value: ModelJsonValue } | { success: false, message: string }
