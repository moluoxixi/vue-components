import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerDiagnostic } from '../../../graph'

export interface DesignSurfaceEmits {
  (event: 'configureEvent', nodeId: string, eventName: string): void
  (event: 'configureFlow', trigger: ConfigFormFlowTrigger): void
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'notice', message: string, undo?: () => boolean): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'selectionSetChange', nodeIds: string[], primaryId: string | undefined): void
}
