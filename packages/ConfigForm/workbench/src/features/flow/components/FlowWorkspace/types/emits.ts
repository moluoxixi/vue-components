export interface FlowWorkspaceEmits {
  close: []
}

export interface FlowWorkspaceExpose {
  confirmClose: () => Promise<boolean>
  requestClose: () => Promise<void>
  save: () => Promise<boolean>
}
