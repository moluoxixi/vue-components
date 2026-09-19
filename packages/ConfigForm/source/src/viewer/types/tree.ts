import type { SourceFile } from '../../generator'

interface SourceTreeNodeBase {
  id: string
  name: string
  path: string
}

export interface SourceTreeDirectoryNode extends SourceTreeNodeBase {
  children: SourceTreeNode[]
  kind: 'directory'
}

export interface SourceTreeFileNode extends SourceTreeNodeBase {
  file: SourceFile
  kind: 'file'
}

export type SourceTreeNode = SourceTreeDirectoryNode | SourceTreeFileNode

export interface VisibleSourceTreeNode {
  depth: number
  node: SourceTreeNode
  parentId?: string
}

export type SourceViewerPane = 'code' | 'tree'

export interface SourceFileTreeProps {
  nodes: readonly SourceTreeNode[]
  selectedPath: string
}

export interface SourceFileTreeEmits {
  select: [path: string]
}

export interface SourceFileTreeNodeProps {
  expandedIds: ReadonlySet<string>
  focusedId: string | undefined
  node: SourceTreeNode
  selectedPath: string
}

export interface SourceFileTreeNodeEmits {
  activate: [node: SourceTreeNode]
  focusNode: [id: string]
}
