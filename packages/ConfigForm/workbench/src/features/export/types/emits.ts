import type { ModelDiagnostic } from '@moluoxixi/config-form-model'

export interface SourceWorkspaceEmits {
  'diagnostics': [diagnostics: readonly ModelDiagnostic[]]
  'notice': [notice: { message: string, tone: 'success' | 'error' }]
  'update:mode': [mode: 'source' | 'config']
}
