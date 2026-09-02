import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectPage, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { WorkbenchLocaleId } from '../../locale'
import type { WorkbenchPaletteFamily, WorkbenchThemePreference } from './appearance'

export type WorkbenchExportMode = 'source' | 'config'

export interface WorkbenchTopbarProps {
  project?: ReadonlyProjectDocument
  busy?: boolean
  configError?: string
  currentPage?: ProjectPage
  dirty?: boolean
  flowOpen?: boolean
  locale?: DesignerLocaleOptions
  localeId: WorkbenchLocaleId
  paletteFamily: WorkbenchPaletteFamily
  previewOpen?: boolean
  repositoryRevision?: number
  statusLabel: string
  themePreference: WorkbenchThemePreference
}

export interface WorkbenchTopbarEmits {
  export: [mode: WorkbenchExportMode]
  newPage: [focusKey: string]
  openAppearance: []
  openFlow: []
  openPages: []
  openVersions: []
  createCheckpoint: []
  save: []
  setPaletteFamily: [value: WorkbenchPaletteFamily]
  setThemePreference: [value: WorkbenchThemePreference]
  toggleLocale: []
  togglePreview: []
}
