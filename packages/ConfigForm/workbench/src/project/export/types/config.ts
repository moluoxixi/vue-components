import type { ProjectPath, WorkspaceFile } from '../../types'

export interface CanonicalConfigExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}

/** Host implementations are deliberately excluded from the exported data. */
export interface ConfigRuntimeBindingRequirement {
  kind: 'component' | 'validator' | 'action' | 'dataSource'
  ref: string
  pageId: string
  path: Array<string | number>
  nodeId?: string
  flowId?: string
  sourceId?: string
}
