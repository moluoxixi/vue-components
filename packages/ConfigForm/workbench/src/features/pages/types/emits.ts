import type { ProjectSurfaceAction } from '../../../project'

export interface SurfaceManagerPageEmits {
  action: [action: ProjectSurfaceAction]
  createSurface: [kind?: 'page' | 'dialog' | 'drawer']
  useTemplate: []
  saveTemplate: [id: string]
  importSurface: []
  /** Export one page's transfer JSON. */
  export: [id: string]
  /** Export one page's copy-friendly source directory. */
  exportSource: [id: string]
  /** Open one page's form designer. */
  openPage: [id: string]
  /** Leave page management for the projects list. */
  openProjects: []
}
