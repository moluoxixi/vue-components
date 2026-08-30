import type { ConfigFormComponentRegistry } from '@moluoxixi/config-form-headless'
import type {
  ConfigFormRendererNode,
  ConfigFormResponsiveLayout,
} from '@moluoxixi/config-form/renderer'
import type { DesignerDiagnostic, DesignerDocument } from '../document'

export interface DesignerRendererConfig {
  components?: ConfigFormComponentRegistry
  fields: ConfigFormRendererNode[]
  readonly?: boolean
  inline?: boolean
  columns?: number
  gap?: string
  fieldSpan?: number
  labelPosition?: 'left' | 'top'
  responsive?: ConfigFormResponsiveLayout
}

export interface DesignerCompileSuccess {
  success: true
  document: DesignerDocument
  fields: ConfigFormRendererNode[]
  renderer: DesignerRendererConfig
  diagnostics: DesignerDiagnostic[]
}

/** Runtime projection compiled directly from the canonical LowCodePageModel. */
export interface ConfigModelCompileSuccess {
  success: true
  fields: ConfigFormRendererNode[]
  renderer: DesignerRendererConfig
  diagnostics: DesignerDiagnostic[]
}

export interface ConfigModelCompileFailure {
  success: false
  fields?: undefined
  renderer?: undefined
  diagnostics: DesignerDiagnostic[]
}

export type ConfigModelCompileResult = ConfigModelCompileSuccess | ConfigModelCompileFailure

export interface DesignerCompileFailure {
  success: false
  document?: DesignerDocument
  fields?: undefined
  renderer?: undefined
  diagnostics: DesignerDiagnostic[]
}

export type DesignerCompileResult = DesignerCompileSuccess | DesignerCompileFailure
