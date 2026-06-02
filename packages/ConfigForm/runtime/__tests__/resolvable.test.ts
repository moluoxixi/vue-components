import { describe, expect, it } from 'vitest'
import { resolveValue } from '../src/utils/resolvable'

describe('resolvable utils', () => {
  it('returns direct values without reading context', () => {
    expect(resolveValue(true, { enabled: false }, false)).toBe(true)
  })

  it('resolves function values with the provided context', () => {
    const context = { enabled: true }

    expect(resolveValue(values => values.enabled, context, false)).toBe(true)
  })

  it('uses the default value for nullish declarations', () => {
    expect(resolveValue(undefined, {}, false)).toBe(false)
    expect(resolveValue(null, {}, true)).toBe(true)
  })

  it('propagates resolver errors without rewriting them', () => {
    const error = new Error('resolver failed')

    expect(() => resolveValue(() => {
      throw error
    }, {}, false)).toThrow(error)
  })
})
