import type { ProjectPageAction } from '../../../project'

export interface PageManagerDialogEmits {
  close: []
  createPage: []
  createProject: []
  openProject: [id: string]
  action: [action: ProjectPageAction]
  returnFocusRestored: []
}
