import type {
  CompiledDesignerCondition,
  DesignerConditionExpression,
  DesignerConditionValues,
} from './types'
import { evaluateConfigFormReactionCondition } from '@moluoxixi/config-form-core'

export function evaluateDesignerCondition(
  expression: DesignerConditionExpression,
  values: DesignerConditionValues,
): boolean {
  return evaluateConfigFormReactionCondition(expression, values)
}

export function compileDesignerCondition(expression: DesignerConditionExpression): CompiledDesignerCondition {
  return values => evaluateDesignerCondition(expression, values)
}
