import { describe, expect, it } from 'vitest'
import {
  cloneDesignerResolvedOptionState,
  createDesignerOptionKey,
  createDesignerOptionSourceCacheKey,
  createMissingDesignerOptionSourceState,
  normalizeDesignerOptions,
  readDesignerOptionSource,
} from '../index'

describe('designer option contracts', () => {
  it('reads only serializable option sources', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(readDesignerOptionSource({ kind: 'static' })).toEqual({ kind: 'static' })
    expect(readDesignerOptionSource({ kind: 'dictionary', key: 'teams' })).toEqual({ kind: 'dictionary', key: 'teams' })
    expect(readDesignerOptionSource({ kind: 'provider', key: 'teams', params: { active: true } })).toEqual({
      kind: 'provider',
      key: 'teams',
      params: { active: true },
    })
    expect(readDesignerOptionSource({ kind: 'provider', key: 'teams', params: circular })).toBeUndefined()
    expect(readDesignerOptionSource({ kind: 'provider', key: 'teams', params: new Date() })).toBeUndefined()
  })

  it('normalizes portable option values and drops invalid entries', () => {
    expect(normalizeDesignerOptions([
      { label: 'Text', value: 'text' },
      { label: 'Count', value: 1, disabled: true },
      { label: 'Enabled', value: false, disabled: 'no' },
      { label: 'Invalid number', value: Number.NaN },
      { value: 'missing label' },
    ])).toEqual([
      { label: 'Text', value: 'text' },
      { label: 'Count', value: 1, disabled: true },
      { label: 'Enabled', value: false },
    ])
  })

  it('shares stable cache keys and independent resolver state snapshots', () => {
    expect(createDesignerOptionSourceCacheKey({ kind: 'static' })).toBe('static')
    expect(createDesignerOptionSourceCacheKey({ kind: 'dictionary', key: 'teams' })).toBe('dictionary:teams')
    expect(createDesignerOptionSourceCacheKey({ kind: 'provider', key: 'teams', params: { active: true } }))
      .toBe('provider:teams:{"active":true}')
    expect(createDesignerOptionKey(true, 2)).toBe('boolean:true:2')

    const state = { status: 'ready' as const, options: [{ label: 'Team', value: 'team' }] }
    const cloned = cloneDesignerResolvedOptionState(state)
    expect(cloned).toEqual(state)
    expect(cloned.options).not.toBe(state.options)
    expect(cloned.options[0]).not.toBe(state.options[0])
    expect(createMissingDesignerOptionSourceState('provider', 'missing', state.options)).toEqual({
      status: 'error',
      options: state.options,
      error: 'Unknown option provider: missing',
    })
  })
})
