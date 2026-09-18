export interface DesignerPropertyPanelEmits {
  updatePath: [nodeId: string, path: string[], value: unknown]
  updatePaths: [nodeIds: string[], path: string[], value: unknown]
  updateForm: [changes: Record<string, unknown>]
}
