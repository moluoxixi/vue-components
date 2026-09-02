import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ConfigImportTarget, TemplateCreationTarget } from '../../../project'

export interface JsonImportPaneProps {
  locale?: DesignerLocaleOptions
  target: ConfigImportTarget
}

export interface TemplateCreationWorkspaceProps {
  canClose: boolean
  locale?: DesignerLocaleOptions
  target: TemplateCreationTarget
}
