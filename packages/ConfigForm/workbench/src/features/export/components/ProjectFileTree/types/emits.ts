import type { ProjectPath, ProjectTreeNode } from '../../../../../project'

export interface ProjectFileTreeEmits {
  'select': [path: ProjectPath]
  'update:expandedIds': [ids: string[]]
}

export interface ProjectFileTreeNodeEmits {
  activate: [node: ProjectTreeNode]
  focusNode: [id: string]
}
