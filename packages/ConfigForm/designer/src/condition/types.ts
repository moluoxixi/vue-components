import type { DesignerJsonValue } from '../document/types'

export type DesignerConditionTarget = 'visible' | 'hidden' | 'required' | 'disabled' | 'readonly'
export type DesignerConditionCompareOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

export type DesignerConditionOperand
  = | { kind: 'field', field: string }
    | { kind: 'literal', value: DesignerJsonValue }

export type DesignerConditionExpression
  = | { kind: 'literal', value: boolean }
    | {
      kind: 'compare'
      operator: DesignerConditionCompareOperator
      left: DesignerConditionOperand
      right: DesignerConditionOperand
    }
    | { kind: 'and', expressions: DesignerConditionExpression[] }
    | { kind: 'or', expressions: DesignerConditionExpression[] }
    | { kind: 'not', expression: DesignerConditionExpression }

export type DesignerConditionValues = Record<string, unknown>
export type CompiledDesignerCondition = (values: DesignerConditionValues) => boolean
