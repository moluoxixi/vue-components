import type { ProjectSurfaceAction } from '../../../../../project'

export interface SurfaceManagerEmits {
  action: [action: ProjectSurfaceAction]
  close: []
  createSurface: []
  createProject: []
  openProject: [id: string]
}
