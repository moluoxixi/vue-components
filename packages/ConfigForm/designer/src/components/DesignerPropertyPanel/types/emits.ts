export interface DesignerPropertyPanelEmits {
  configureEvent: [payload: { nodeId: string, eventName: string }]
  removeStoredConfig: [nodeId: string, path: string[]]
  updatePath: [nodeId: string, path: string[], value: unknown]
  updatePaths: [nodeIds: string[], path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
}
