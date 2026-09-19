import type { ProjectCompilation } from '@moluoxixi/config-form-compiler'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectRepository } from '@moluoxixi/config-form-model'
import type { BuildExportSnapshotInput } from '../../../project'
import type { ExportMode } from './domain'

export interface ExportDialogProps {
  capture: () => BuildExportSnapshotInput | undefined
  currentCompilation?: ProjectCompilation
  currentSurfaceId?: string
  locale?: DesignerLocaleOptions
  mode?: ExportMode
  readEmbedded: ProjectRepository['readEmbedded']
  theme: 'dark' | 'light'
}
