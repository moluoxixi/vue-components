import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectPath, ProjectTreeNode } from '../../../project'

export interface ProjectFileTreeProps {
  expandedIds: string[]
  locale?: DesignerLocaleOptions
  nodes: ProjectTreeNode[]
  selectedPath?: ProjectPath
}

export interface ProjectFileTreeNodeProps {
  expandedIds: ReadonlySet<string>
  focusedId?: string
  node: ProjectTreeNode
  selectedPath?: ProjectPath
}
