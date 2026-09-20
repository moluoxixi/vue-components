import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { DeepReadonly, ProjectTheme } from '@moluoxixi/config-form-model'

export interface ProjectThemeEditorProps {
  locale?: DesignerLocaleOptions
  modelValue: DeepReadonly<ProjectTheme>
  readonly?: boolean
}
