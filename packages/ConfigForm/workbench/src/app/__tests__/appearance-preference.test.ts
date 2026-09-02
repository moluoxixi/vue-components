// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WORKBENCH_APPEARANCE,
  WORKBENCH_APPEARANCE_STORAGE_KEY,
  WORKBENCH_PALETTE_FAMILIES,
  WORKBENCH_THEME_PREFERENCES,
} from '../constants'
import {
  parseWorkbenchAppearancePreference,
  readWorkbenchAppearancePreference,
  resolveWorkbenchTheme,
  writeWorkbenchAppearancePreference,
} from '../services'

describe('workbench appearance preference', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it.each(WORKBENCH_PALETTE_FAMILIES.flatMap(paletteFamily => [
    ...(['light', 'dark'] as const).map(themePreference => ({
      expected: themePreference,
      paletteFamily,
      systemPrefersDark: false,
      themePreference,
    })),
    ...([false, true] as const).map(systemPrefersDark => ({
      expected: systemPrefersDark ? 'dark' : 'light',
      paletteFamily,
      systemPrefersDark,
      themePreference: 'system' as const,
    })),
  ]))('parses and resolves $paletteFamily/$themePreference/$systemPrefersDark', ({
    expected,
    paletteFamily,
    systemPrefersDark,
    themePreference,
  }) => {
    const parsed = parseWorkbenchAppearancePreference({
      version: 1,
      themePreference,
      paletteFamily,
    })
    expect(parsed).toEqual({ version: 1, themePreference, paletteFamily })
    expect(resolveWorkbenchTheme(themePreference, systemPrefersDark)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    {},
    { version: 2, themePreference: 'system', paletteFamily: 'catppuccin' },
    { version: 1, themePreference: 'auto', paletteFamily: 'catppuccin' },
    { version: 1, themePreference: 'system', paletteFamily: 'nord' },
    { version: 1, themePreference: 'system', paletteFamily: 'catppuccin', extra: true },
  ])('rejects an unknown current-contract value', (value) => {
    expect(parseWorkbenchAppearancePreference(value)).toBeUndefined()
  })

  it('round-trips the current preference and falls back for malformed or blocked storage', () => {
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }
    const preference = { version: 1, themePreference: 'dark', paletteFamily: 'kanagawa' } as const
    writeWorkbenchAppearancePreference(preference, adapter)
    expect(readWorkbenchAppearancePreference(adapter)).toEqual(preference)

    storage.set(WORKBENCH_APPEARANCE_STORAGE_KEY, '{bad json')
    expect(readWorkbenchAppearancePreference(adapter)).toEqual(DEFAULT_WORKBENCH_APPEARANCE)

    const blocked = {
      getItem: vi.fn(() => { throw new Error('blocked') }),
      setItem: vi.fn(() => { throw new Error('blocked') }),
    }
    expect(readWorkbenchAppearancePreference(blocked)).toEqual(DEFAULT_WORKBENCH_APPEARANCE)
    expect(() => writeWorkbenchAppearancePreference(preference, blocked)).not.toThrow()
  })

  it('exports the complete preference option sets', () => {
    expect(WORKBENCH_THEME_PREFERENCES).toEqual(['system', 'light', 'dark'])
    expect(WORKBENCH_PALETTE_FAMILIES).toEqual(['catppuccin', 'kanagawa', 'gruvbox', 'rose-pine'])
  })

  it('keeps the synchronous bootstrap aligned and resolves appearance before mount', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1]
    expect(bootstrap).toBeTruthy()
    expect(bootstrap).toContain(WORKBENCH_APPEARANCE_STORAGE_KEY)
    for (const value of [...WORKBENCH_THEME_PREFERENCES, ...WORKBENCH_PALETTE_FAMILIES])
      expect(bootstrap).toContain(`'${value}'`)

    localStorage.setItem(WORKBENCH_APPEARANCE_STORAGE_KEY, JSON.stringify({
      version: 1,
      themePreference: 'system',
      paletteFamily: 'rose-pine',
    }))
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    runInNewContext(bootstrap!, { document, localStorage, matchMedia })
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('rose-pine')
  })

  it.each([
    '{bad json',
    JSON.stringify({ version: 2, themePreference: 'dark', paletteFamily: 'kanagawa' }),
    JSON.stringify({ version: 1, themePreference: 'auto', paletteFamily: 'catppuccin' }),
    JSON.stringify({ version: 1, themePreference: 'system', paletteFamily: 'nord' }),
    JSON.stringify({ version: 1, themePreference: 'system', paletteFamily: 'catppuccin', extra: true }),
  ])('makes the synchronous bootstrap fail closed for invalid storage: %s', (stored) => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1]
    localStorage.setItem(WORKBENCH_APPEARANCE_STORAGE_KEY, stored)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))

    runInNewContext(bootstrap!, { document, localStorage, matchMedia })

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.palette).toBe('catppuccin')
  })

  it('makes the synchronous bootstrap fail closed when storage is blocked', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1]
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    runInNewContext(bootstrap!, { document, localStorage, matchMedia })

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('catppuccin')
  })
})
