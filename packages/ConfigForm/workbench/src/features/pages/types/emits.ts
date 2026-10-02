import type { ProjectSurfaceAction } from '../../../project'

export interface SurfaceManagerPageEmits {
  action: [action: ProjectSurfaceAction]
  close: []
  createSurface: []
  /** Export one page's transfer JSON. */
  export: [id: string]
  /** Export one page's copy-friendly source directory. */
  exportSource: [id: string]
  /** Open one page's form designer. */
  openPage: [id: string]
  openProject: [id: string]
  /** Leave page management for the projects list. */
  openProjects: []
}
