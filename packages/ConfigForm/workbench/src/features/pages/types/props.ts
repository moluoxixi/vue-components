import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'

/**
 * Page-management screen.
 *
 * The screen is a routed workspace rather than an overlay, so it owns its own
 * page chrome and receives the resolved appearance tokens from the application
 * shell exactly like the projects screen does.
 */
export interface SurfaceManagerPageProps {
  busy?: boolean
  locale?: DesignerLocaleOptions
  palette: string
  project: ReadonlyProjectDocument
  projects: ProjectSummary[]
  theme: string
}
