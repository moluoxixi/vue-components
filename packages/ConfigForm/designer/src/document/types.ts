import type { RuleJsonValue, RuleSet } from '@moluoxixi/zod3-to-rule'
import type { DesignerConditionExpression, DesignerConditionTarget } from '../condition'
import type { DESIGNER_DOCUMENT_VERSION } from '../constants'

export type DesignerJsonValue = RuleJsonValue
export interface DesignerJsonObject { [key: string]: DesignerJsonValue }
export type DesignerNodeKind = 'field' | 'container'

export interface DesignerFormSettings {
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
}

export interface DesignerNodeBase {
  id: string
  material: string
  props?: DesignerJsonObject
  span?: number
  conditions?: Partial<Record<DesignerConditionTarget, DesignerConditionExpression>>
}

export interface DesignerFieldNode extends DesignerNodeBase {
  kind: 'field'
  field: string
  label?: string
  defaultValue?: DesignerJsonValue
  validation?: RuleSet
  validateOn?: 'submit' | 'blur' | 'change' | Array<'submit' | 'blur' | 'change'>
}

export interface DesignerContainerNode extends DesignerNodeBase {
  kind: 'container'
  slots: Record<string, DesignerNode[]>
}

export type DesignerNode = DesignerFieldNode | DesignerContainerNode

export interface DesignerDocument {
  version: typeof DESIGNER_DOCUMENT_VERSION
  form: DesignerFormSettings
  nodes: DesignerNode[]
}

export type DesignerDiagnosticSeverity = 'error' | 'warning'

export interface DesignerDiagnostic {
  code: string
  severity: DesignerDiagnosticSeverity
  path: (string | number)[]
  message: string
  nodeId?: string
}

export interface DesignerParseSuccess {
  success: true
  data: DesignerDocument
  diagnostics: []
}

export interface DesignerParseFailure {
  success: false
  data?: undefined
  diagnostics: DesignerDiagnostic[]
}

export type DesignerParseResult = DesignerParseSuccess | DesignerParseFailure

export interface DesignerMigrationResult {
  data?: unknown
  diagnostics: DesignerDiagnostic[]
}
