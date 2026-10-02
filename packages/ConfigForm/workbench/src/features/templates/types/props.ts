import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ConfigImportTarget, TemplateCreationTarget } from '../../../project'

export interface JsonImportPaneProps {
  locale?: DesignerLocaleOptions
  target: ConfigImportTarget
}

export interface TemplateCreationWorkspaceProps {
  canClose: boolean
  initialMode?: 'json' | 'template'
  locale?: DesignerLocaleOptions
  /** User-facing page kind filter; `page` is presented as a Form. */
  surfaceKind?: 'page' | 'dialog' | 'drawer'
  target: TemplateCreationTarget
}
