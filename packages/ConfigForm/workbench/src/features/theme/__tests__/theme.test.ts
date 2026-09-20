import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_THEME, expandProjectTheme } from '../services'

describe('project theme services', () => {
  it('expands sparse persisted tokens without mutating the source', () => {
    const source = { version: 1 as const, colors: { primary: '#336699' }, spacing: { md: 20 } }
    const expanded = expandProjectTheme(source)
    expect(expanded.colors).toMatchObject({ primary: '#336699', canvas: '#F4F6F8' })
    expect(expanded.spacing).toMatchObject({ xs: 4, md: 20, xl: 32 })
    expect(expanded.shadows).toEqual(DEFAULT_PROJECT_THEME.shadows)
    expect(expanded).not.toBe(source)
  })
})
