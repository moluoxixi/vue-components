import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'

export interface WorkspaceCodeEditorProps {
  filename: string
  language?: string
  locale?: DesignerLocaleOptions
  modelValue: string
  moduleNames?: readonly string[]
  readonly?: boolean
  theme?: 'dark' | 'light'
}
