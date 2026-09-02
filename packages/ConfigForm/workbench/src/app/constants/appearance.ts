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
  'catppuccin',
  'kanagawa',
  'gruvbox',
  'rose-pine',
] as const satisfies readonly WorkbenchPaletteFamily[]

export const DEFAULT_WORKBENCH_APPEARANCE: Readonly<WorkbenchAppearancePreference> = {
  version: WORKBENCH_APPEARANCE_VERSION,
  themePreference: 'system',
  paletteFamily: 'catppuccin',
}

export const WORKBENCH_PALETTE_SWATCHES: Readonly<Record<
  WorkbenchPaletteFamily,
  { dark: readonly string[], light: readonly string[] }
>> = {
  'catppuccin': {
    light: ['#eff1f5', '#e6e9ef', '#8839ef', '#40a02b'],
    dark: ['#1e1e2e', '#313244', '#cba6f7', '#a6e3a1'],
  },
  'kanagawa': {
    light: ['#f2ecbc', '#e5ddb0', '#c84053', '#6f894e'],
    dark: ['#1f1f28', '#2a2a37', '#e46876', '#76946a'],
  },
  'gruvbox': {
    light: ['#fbf1c7', '#f4e8be', '#945e80', '#6c782e'],
    dark: ['#282828', '#32302f', '#d3869b', '#a9b665'],
  },
  'rose-pine': {
    light: ['#faf4ed', '#fffaf3', '#b4637a', '#6d8f89'],
    dark: ['#191724', '#1f1d2e', '#eb6f92', '#95b1ac'],
  },
}
