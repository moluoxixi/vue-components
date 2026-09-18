import type { ProjectPath, WorkspaceFile } from '../../types'

export interface CanonicalConfigExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}

/** Host implementations are deliberately excluded from the exported data. */
export interface ConfigRuntimeBindingRequirement {
  kind: 'component' | 'validator' | 'dataSource'
  ref: string
  pageId: string
  path: Array<string | number>
  nodeId?: string
  sourceId?: string
}
