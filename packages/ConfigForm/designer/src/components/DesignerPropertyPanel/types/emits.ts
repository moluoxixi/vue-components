import type { DatasetReference, PrototypeInteraction } from '@moluoxixi/config-form-model'

export interface DesignerPropertyPanelEmits {
  updatePath: [nodeId: string, path: string[], value: unknown]
  updatePaths: [nodeIds: string[], path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
  updateInteractions: [interactions: PrototypeInteraction[]]
  updateDatasetBinding: [nodeId: string, bindingKey: string, reference: DatasetReference | undefined]
  updateResourceBinding: [nodeId: string, bindingKey: string, resourceId: string | undefined]
  saveOptionsAsDataset: [nodeId: string, bindingKey: string, name: string]
  materializeOptionsSnapshot: [nodeId: string, bindingKey: string]
}
