import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'

export type WorkbenchThemePreference = 'system' | 'light' | 'dark'
export type WorkbenchResolvedTheme = 'light' | 'dark'
export type WorkbenchPaletteFamily = 'catppuccin' | 'kanagawa' | 'gruvbox' | 'rose-pine'

export interface WorkbenchAppearancePreference {
  version: 1
  themePreference: WorkbenchThemePreference
  paletteFamily: WorkbenchPaletteFamily
}

export interface WorkbenchAppearancePanelProps {
  locale?: DesignerLocaleOptions
  paletteFamily: WorkbenchPaletteFamily
  themePreference: WorkbenchThemePreference
}

export interface WorkbenchAppearancePanelEmits {
  setPaletteFamily: [value: WorkbenchPaletteFamily]
  setThemePreference: [value: WorkbenchThemePreference]
}

export interface WorkbenchAppearancePopoverProps extends WorkbenchAppearancePanelProps {
  triggerClass?: string
}

export interface WorkbenchAppearanceDrawerProps extends WorkbenchAppearancePanelProps {
  open: boolean
}

export interface WorkbenchAppearanceDrawerEmits extends WorkbenchAppearancePanelEmits {
  close: []
}
