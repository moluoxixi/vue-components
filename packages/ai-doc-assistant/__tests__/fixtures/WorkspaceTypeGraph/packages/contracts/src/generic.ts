export interface WorkspaceLeaf {
  id: string
}

export interface WorkspacePage<T> {
  items: T[]
  total: number
}

export interface WorkspaceEnvelope<T> {
  page: WorkspacePage<T>
}
