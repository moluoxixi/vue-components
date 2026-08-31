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
