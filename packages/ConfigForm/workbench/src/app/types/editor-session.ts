import type { ModelDiagnostic } from '@moluoxixi/config-form-model'

export type StudioMode = 'design' | 'experience' | 'handoff'
export type DiagnosticOrigin = 'model' | 'compiler' | 'preview' | 'export'
export interface StudioDiagnostic extends ModelDiagnostic {
  severity: 'error' | 'warning' | 'info'
  origin: DiagnosticOrigin
}
