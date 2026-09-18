import type { DesignerDiagnostic } from '../../../graph'

export interface DesignSurfaceEmits {
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'notice', message: string, undo?: () => boolean): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'selectionSetChange', nodeIds: string[], primaryId: string | undefined): void
}
