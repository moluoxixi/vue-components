import type { TemplateCreationTarget } from '../../project'

export interface WorkbenchShellProps {
  creationReturnFocusKey?: string
}

export interface WorkbenchShellEmits {
  create: [request: { focusKey: string, target: TemplateCreationTarget }]
  creationFocusRestored: []
}
