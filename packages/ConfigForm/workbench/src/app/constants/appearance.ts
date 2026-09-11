import type {
  WorkbenchAppearancePreference,
  WorkbenchPaletteFamily,
  WorkbenchThemePreference,
} from '../types'

export const WORKBENCH_APPEARANCE_STORAGE_KEY = 'moluoxixi.config-form.workbench.appearance'
export const WORKBENCH_APPEARANCE_VERSION = 1 as const

export const WORKBENCH_THEME_PREFERENCES = [
  'system',
  'light',
  'dark',
] as const satisfies readonly WorkbenchThemePreference[]

export const WORKBENCH_PALETTE_FAMILIES = [
  'ink',
  'morandi',
  'cyber',
  'glass',
] as const satisfies readonly WorkbenchPaletteFamily[]

export const DEFAULT_WORKBENCH_APPEARANCE: Readonly<WorkbenchAppearancePreference> = {
  version: WORKBENCH_APPEARANCE_VERSION,
  themePreference: 'system',
  paletteFamily: 'ink',
}

export const WORKBENCH_PALETTE_SWATCHES: Readonly<Record<
  WorkbenchPaletteFamily,
  { dark: readonly string[], light: readonly string[] }
>> = {
  ink: {
    light: ['#f7f4ec', '#fdfaf2', '#363634', '#a63a2e'],
    dark: ['#1b1b19', '#252522', '#d8d4c8', '#c4483b'],
  },
  morandi: {
    light: ['#f5f2ec', '#ffffff', '#716b5c', '#b37f72'],
    dark: ['#2c2925', '#37332e', '#b9b1a4', '#d3a196'],
  },
  cyber: {
    light: ['#eff3f8', '#ffffff', '#0b6cff', '#00cfe0'],
    dark: ['#0a0f1e', '#121a2e', '#3d8bff', '#00f0ff'],
  },
  glass: {
    light: ['#eef1fb', '#fdf1f6', '#5a5ded', '#ec4899'],
    dark: ['#0c1122', '#1b2440', '#818cf8', '#f471b5'],
  },
}
