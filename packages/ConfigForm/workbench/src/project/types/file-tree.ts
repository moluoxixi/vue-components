import type { ProjectPath, WorkspaceFile } from './workspace'

interface ProjectTreeNodeBase {
  id: string
  name: string
}

export interface ProjectTreeDirectory extends ProjectTreeNodeBase {
  children: ProjectTreeNode[]
  kind: 'directory'
  path: string
}

export interface ProjectTreeFile extends ProjectTreeNodeBase {
  file: Readonly<WorkspaceFile>
  kind: 'file'
  path: ProjectPath
}

export type ProjectTreeNode = ProjectTreeDirectory | ProjectTreeFile

export interface VisibleProjectTreeNode {
  level: number
  node: ProjectTreeNode
  parentId?: string
}

export type ProjectFileIconKind = 'binary' | 'code' | 'json' | 'text'
