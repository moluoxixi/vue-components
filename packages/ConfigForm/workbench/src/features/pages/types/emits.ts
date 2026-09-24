import type { ProjectSurfaceAction } from '../../../project'

export interface SurfaceManagerPageEmits {
  action: [action: ProjectSurfaceAction]
  close: []
  createSurface: []
  /** Open one page's form designer. */
  openPage: [id: string]
  openProject: [id: string]
  /** Leave page management for the projects list. */
  openProjects: []
}
