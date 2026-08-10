import { describe, expect, it } from 'vitest'
import { readValueByPath } from '../src/index'

describe('path Utilities', () => {
  it('reads nested values by dot path', () => {
    expect(readValueByPath({ profile: { age: 18 } }, 'profile.age')).toBe(18)
  })

  it('returns the original source when path is not declared', () => {
    const source = { ok: true }

    expect(readValueByPath(source, undefined)).toBe(source)
  })

  it('returns undefined for missing loose paths', () => {
    expect(readValueByPath({ profile: {} }, 'profile.age')).toBeUndefined()
  })

  it('throws caller-defined errors for missing strict paths', () => {
    expect(() => readValueByPath({ profile: {} }, 'profile.age', {
      createMissingPathError: path => new Error(`[test] missing ${path}`),
      strict: true,
    })).toThrow('[test] missing profile.age')
  })
})
