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
    light: ['#ffffff', '#f5f6f7', '#27665b', '#27665b'],
    dark: ['#191b1f', '#22252a', '#93c6ad', '#91c5ad'],
  },
  morandi: {
    light: ['#ffffff', '#f5f6f7', '#716b5c', '#b37f72'],
    dark: ['#191b1f', '#22252a', '#b9b1a4', '#d3a196'],
  },
  cyber: {
    light: ['#ffffff', '#f5f6f7', '#0b6cff', '#0b6cff'],
    dark: ['#191b1f', '#22252a', '#3d8bff', '#00f0ff'],
  },
  glass: {
    light: ['#ffffff', '#f5f6f7', '#5a5ded', '#ec4899'],
    dark: ['#191b1f', '#22252a', '#818cf8', '#f471b5'],
  },
}
