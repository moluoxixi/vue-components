import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSurface, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { WorkbenchLocaleId } from '../../locale'
import type { WorkbenchPaletteFamily, WorkbenchThemePreference } from './appearance'

export type WorkbenchExportMode = 'source' | 'config'
export type WorkbenchExportCommand = WorkbenchExportMode | 'project-json' | 'surface-json' | 'surface-source'

export interface WorkbenchTopbarProps {
  project?: ReadonlyProjectDocument
  busy?: boolean
  configError?: string
  currentSurface?: ProjectSurface
  dirty?: boolean
  locale?: DesignerLocaleOptions
  localeId: WorkbenchLocaleId
  paletteFamily: WorkbenchPaletteFamily
  previewOpen?: boolean
  sourceOpen?: boolean
  repositoryRevision?: number
  statusLabel: string
  themePreference: WorkbenchThemePreference
}

export interface WorkbenchTopbarEmits {
  export: [command: WorkbenchExportCommand]
  openAppearance: []
  openProjects: []
  openSurfaces: []
  openVersions: []
  createCheckpoint: []
  save: []
  showDesign: []
  setPaletteFamily: [value: WorkbenchPaletteFamily]
  setThemePreference: [value: WorkbenchThemePreference]
  toggleLocale: []
  togglePreview: []
}
