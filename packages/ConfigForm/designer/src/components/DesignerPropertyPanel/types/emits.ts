import type { ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'

export interface DesignerPropertyPanelEmits {
  configureEvent: [payload: { nodeId: string, eventName: string }]
  configureFlow: [trigger: ConfigFormFlowTrigger]
  removeStoredConfig: [nodeId: string, path: string[]]
  updatePath: [nodeId: string, path: string[], value: unknown]
  updatePaths: [nodeIds: string[], path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
}
