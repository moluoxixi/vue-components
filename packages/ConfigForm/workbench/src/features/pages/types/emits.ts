import type { ProjectSurfaceAction } from '../../../project'

export interface SurfaceManagerDialogEmits {
  close: []
  createSurface: []
  createProject: []
  openProject: [id: string]
  action: [action: ProjectSurfaceAction]
  returnFocusRestored: []
}
