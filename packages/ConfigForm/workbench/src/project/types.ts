export const WORKSPACE_PROJECT_SCHEMA_VERSION = 1 as const
export const WORKSPACE_STORAGE_SCHEMA_VERSION = 1 as const

export type WorkspaceAdapter = 'antd-vue' | 'element-plus'
export type ProjectPath = string & { readonly __projectPath: unique symbol }

export interface WorkspaceTextFile {
  content: string
  kind: 'text'
  language?: string
}

export interface WorkspaceBinaryFile {
  content: Uint8Array
  kind: 'binary'
}

export type WorkspaceFile = WorkspaceBinaryFile | WorkspaceTextFile

export interface WorkspaceProjectManifest {
  adapter: WorkspaceAdapter
  dependencies: Record<string, string>
  designerArtifact: ProjectPath
  entry: ProjectPath
  framework: 'vue'
  generatedFormModule: ProjectPath
}

export interface WorkspaceProject {
  createdAt: string
  files: Record<ProjectPath, WorkspaceFile>
  id: string
  manifest: WorkspaceProjectManifest
  name: string
  revision: number
  schemaVersion: typeof WORKSPACE_PROJECT_SCHEMA_VERSION
  template: {
    id: string
    version: number
  }
  updatedAt: string
}

export interface WorkspaceProjectSummary {
  adapter: WorkspaceAdapter
  id: string
  name: string
  revision: number
  templateId: string
  updatedAt: string
}

export interface WorkspaceProjectDraft {
  baseRevision: number
  files: Partial<Record<ProjectPath, string>>
  updatedAt: string
}

export interface StoredWorkspaceProject {
  draft?: WorkspaceProjectDraft
  project: WorkspaceProject
  storageSchemaVersion: typeof WORKSPACE_STORAGE_SCHEMA_VERSION
}

export interface WorkspaceProjectClock {
  now: () => string
}
