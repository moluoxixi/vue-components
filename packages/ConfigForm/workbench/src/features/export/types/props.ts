import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { BuildExportSnapshotInput } from '../../../project'
import type { ExportMode } from './domain'

export interface ExportDialogProps {
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation?: ProjectCompilation
  currentPageId?: string
  locale?: DesignerLocaleOptions
  mode?: ExportMode
  theme: 'dark' | 'light'
}
