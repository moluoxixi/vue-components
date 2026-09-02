import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'

export interface PageManagerProps {
  busy?: boolean
  locale?: DesignerLocaleOptions
  project: ReadonlyProjectDocument
  projects: ProjectSummary[]
}
