import type { DatasetReference } from '@moluoxixi/config-form-model'
import type { DesignerDiagnostic } from '../../../graph'

export interface DesignSurfaceEmits {
  (event: 'diagnostics', diagnostics: DesignerDiagnostic[]): void
  (event: 'notice', message: string, undo?: () => boolean): void
  (event: 'selectionChange', nodeId: string | undefined): void
  (event: 'selectionSetChange', nodeIds: string[], primaryId: string | undefined): void
  (event: 'updateDatasetBinding', nodeId: string, bindingKey: string, reference: DatasetReference | undefined): void
  (event: 'updateResourceBinding', nodeId: string, bindingKey: string, resourceId: string | undefined): void
  (event: 'saveOptionsAsDataset', nodeId: string, bindingKey: string, name: string): void
  (event: 'materializeOptionsSnapshot', nodeId: string, bindingKey: string): void
}
