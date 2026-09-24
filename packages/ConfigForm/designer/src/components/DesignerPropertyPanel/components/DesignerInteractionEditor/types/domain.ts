import type { ModelJsonValue } from '@moluoxixi/config-form-model'

export interface DesignerInteractionFieldOption {
  field: string
  id: string
  label: string
}

export type DesignerExpressionPurpose = 'condition' | 'value'

export type DesignerLiteralKind = 'boolean' | 'null' | 'number' | 'string'

export interface DesignerSimpleExpressionDraft {
  fieldId?: string
  literal: ModelJsonValue
  operator: '!=' | '<' | '<=' | '==' | '>' | '>='
}
