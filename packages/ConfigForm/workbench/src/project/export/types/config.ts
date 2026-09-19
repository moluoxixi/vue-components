import type { ProjectPath, WorkspaceFile } from '../../types'

export interface CanonicalConfigExport {
  entry: ProjectPath
  files: Record<ProjectPath, WorkspaceFile>
}

/** Host implementations are deliberately excluded from the exported data. */
export interface ConfigRuntimeBindingRequirement {
  kind: 'component' | 'validator'
  ref: string
  surfaceId: string
  path: Array<string | number>
  nodeId?: string
}
