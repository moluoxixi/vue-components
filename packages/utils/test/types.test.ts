import type { PluginOptions } from '../index'
import { describe, expectTypeOf, it } from 'vitest'

describe('core type helpers', () => {
  it('extracts options only from plugin-like factories', () => {
    type PluginFactory = (options?: { enabled: boolean }) => { name: string }

    expectTypeOf<PluginOptions<PluginFactory>>().toEqualTypeOf<{ enabled: boolean }>()
  })

  it('rejects non-plugin factories at type level', () => {
    // @ts-expect-error PluginOptions is intentionally limited to plugin-like factories.
    expectTypeOf<PluginOptions<(options: { enabled: boolean }) => string>>()
  })
})
