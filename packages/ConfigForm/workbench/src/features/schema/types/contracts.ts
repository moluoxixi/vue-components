import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { NodeSubgraph, SurfaceFieldNode } from '@moluoxixi/config-form-model'

export interface SchemaImportDiagnostic {
  path: string
  message: string
  severity: 'error' | 'warning'
}

export interface SchemaImportPreview {
  fields: SurfaceFieldNode[]
  subgraph: NodeSubgraph
  diagnostics: SchemaImportDiagnostic[]
}

export interface SchemaImportDialogProps {
  modelValue: boolean
  adapter: 'element-plus' | 'antd-vue'
  existingFields: readonly string[]
  locale?: DesignerLocaleOptions
}
