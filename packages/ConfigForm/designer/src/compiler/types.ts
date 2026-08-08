import type {
  ConfigFormRendererNode,
} from '@moluoxixi/config-form/renderer'
import type { DesignerDiagnostic, DesignerDocument } from '../document'

export interface DesignerRendererConfig {
  fields: ConfigFormRendererNode[]
  readonly?: boolean
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
}

export interface DesignerCompileSuccess {
  success: true
  document: DesignerDocument
  fields: ConfigFormRendererNode[]
  renderer: DesignerRendererConfig
  diagnostics: DesignerDiagnostic[]
}

export interface DesignerCompileFailure {
  success: false
  document?: DesignerDocument
  fields?: undefined
  renderer?: undefined
  diagnostics: DesignerDiagnostic[]
}

export type DesignerCompileResult = DesignerCompileSuccess | DesignerCompileFailure
