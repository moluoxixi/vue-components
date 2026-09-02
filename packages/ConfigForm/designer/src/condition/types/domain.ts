import type {
  ConfigFormReactionCompareOperator,
  ConfigFormReactionCondition,
  ConfigFormReactionOperand,
} from '@moluoxixi/config-form-core'

export type DesignerConditionTarget = 'visible' | 'hidden' | 'required' | 'disabled' | 'readonly'
export type DesignerConditionCompareOperator = ConfigFormReactionCompareOperator
export type DesignerConditionOperand = ConfigFormReactionOperand
export type DesignerConditionExpression = ConfigFormReactionCondition

export type DesignerConditionValues = Record<string, unknown>
export type CompiledDesignerCondition = (values: DesignerConditionValues) => boolean
