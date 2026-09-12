export interface DataWorkspaceExpose {
  cancel: () => void
  confirmClose: () => Promise<boolean>
  save: () => Promise<boolean>
  testDataSource: () => Promise<void>
}
