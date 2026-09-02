import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'

export interface PageManagerDialogProps {
  project?: ReadonlyProjectDocument
  projects: ProjectSummary[]
  busy?: boolean
  locale?: DesignerLocaleOptions
  open: boolean
  returnFocusKey?: string
}
