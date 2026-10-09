import type { InjectionKey } from 'vue'
import type { DesignerExpressionEvaluator } from '../types'

export const DESIGNER_EXPRESSION_EVALUATOR_KEY: InjectionKey<() => DesignerExpressionEvaluator | undefined> = Symbol(
  'designer-expression-evaluator',
)
