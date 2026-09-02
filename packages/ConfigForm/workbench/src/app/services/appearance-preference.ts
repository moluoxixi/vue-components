import type {
  WorkbenchAppearancePreference,
  WorkbenchResolvedTheme,
} from '../types'
import {
  DEFAULT_WORKBENCH_APPEARANCE,
  WORKBENCH_APPEARANCE_STORAGE_KEY,
  WORKBENCH_APPEARANCE_VERSION,
  WORKBENCH_PALETTE_FAMILIES,
  WORKBENCH_THEME_PREFERENCES,
} from '../constants'

type AppearanceStorage = Pick<Storage, 'getItem' | 'setItem'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function defaultWorkbenchAppearance(): WorkbenchAppearancePreference {
  return { ...DEFAULT_WORKBENCH_APPEARANCE }
}

export function parseWorkbenchAppearancePreference(value: unknown): WorkbenchAppearancePreference | undefined {
  if (!isRecord(value))
    return undefined
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== 'paletteFamily,themePreference,version')
    return undefined
  if (value.version !== WORKBENCH_APPEARANCE_VERSION)
    return undefined
  if (!WORKBENCH_THEME_PREFERENCES.includes(value.themePreference as never))
    return undefined
  if (!WORKBENCH_PALETTE_FAMILIES.includes(value.paletteFamily as never))
    return undefined
  return {
    version: WORKBENCH_APPEARANCE_VERSION,
    themePreference: value.themePreference as WorkbenchAppearancePreference['themePreference'],
    paletteFamily: value.paletteFamily as WorkbenchAppearancePreference['paletteFamily'],
  }
}

export function readWorkbenchAppearancePreference(
  storage?: AppearanceStorage,
): WorkbenchAppearancePreference {
  if (!storage)
    return defaultWorkbenchAppearance()
  try {
    const raw = storage.getItem(WORKBENCH_APPEARANCE_STORAGE_KEY)
    return raw
      ? parseWorkbenchAppearancePreference(JSON.parse(raw)) ?? defaultWorkbenchAppearance()
      : defaultWorkbenchAppearance()
  }
  catch {
    return defaultWorkbenchAppearance()
  }
}

export function writeWorkbenchAppearancePreference(
  value: WorkbenchAppearancePreference,
  storage?: AppearanceStorage,
): void {
  if (!storage)
    return
  try {
    storage.setItem(WORKBENCH_APPEARANCE_STORAGE_KEY, JSON.stringify(value))
  }
  catch {
    // Browser privacy settings may deny storage; the in-memory preference remains valid.
  }
}

export function resolveWorkbenchTheme(
  preference: WorkbenchAppearancePreference['themePreference'],
  systemPrefersDark: boolean,
): WorkbenchResolvedTheme {
  if (preference === 'system')
    return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function resolveWorkbenchAppearanceStorage(): AppearanceStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  }
  catch {
    return undefined
  }
}
