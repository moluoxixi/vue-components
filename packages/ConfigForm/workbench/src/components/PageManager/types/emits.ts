import type { ProjectPageAction } from '../../../project'

export interface PageManagerEmits {
  action: [action: ProjectPageAction]
  close: []
  createPage: []
  createProject: []
  openProject: [id: string]
}
