import type { ConfigFormModuleRegistryError, ConfigFormNamedModuleMap } from '../index'
import { describe, expect, it } from 'vitest'
import {
  createConfigFormModuleRegistry,
  defineConfigFormModule,
} from '../index'

describe('config-form module registry', () => {
  it('collects eager module imports in deterministic order', () => {
    const registry = createConfigFormModuleRegistry({
      './materials/beta.ts': {
        default: defineConfigFormModule({ name: 'beta', order: 20, value: 'B' }),
      },
      '.\\materials\\alpha.ts': defineConfigFormModule({ name: 'alpha', order: 10, value: 'A' }),
      './materials/gamma.ts': defineConfigFormModule({ name: 'gamma', value: 'G' }),
    })

    expect(registry.list()).toEqual([
      { name: 'alpha', order: 10, source: '.\\materials\\alpha.ts', value: 'A' },
      { name: 'beta', order: 20, source: './materials/beta.ts', value: 'B' },
      { name: 'gamma', source: './materials/gamma.ts', value: 'G' },
    ])
    expect(registry.get('beta')).toBe('B')
    expect(registry.toRecord()).toEqual({ alpha: 'A', beta: 'B', gamma: 'G' })
  })

  it.each([
    {
      code: 'CONFIG_FORM_MODULE_NAME_REQUIRED',
      modules: { './materials/empty.ts': { name: ' ', value: true } },
    },
    {
      code: 'CONFIG_FORM_MODULE_NAME_INVALID',
      modules: { './materials/constructor.ts': { name: 'constructor', value: true } },
    },
    {
      code: 'CONFIG_FORM_MODULE_NAME_INVALID',
      modules: { './materials/BadName.ts': { name: 'BadName', value: true } },
    },
    {
      code: 'CONFIG_FORM_MODULE_NAME_MISMATCH',
      modules: { './materials/text.ts': { name: 'input', value: true } },
    },
    {
      code: 'CONFIG_FORM_MODULE_ORDER_INVALID',
      modules: { './materials/text.ts': { name: 'text', order: -1, value: true } },
    },
    {
      code: 'CONFIG_FORM_MODULE_SOURCE_INVALID',
      modules: { './materials/text.backup.ts': { name: 'text', value: true } },
    },
  ])('rejects invalid scanned modules with $code', ({ code, modules }) => {
    expect(() => createConfigFormModuleRegistry(modules as unknown as ConfigFormNamedModuleMap<boolean>)).toThrowError(
      expect.objectContaining<Partial<ConfigFormModuleRegistryError>>({ code }),
    )
  })

  it('rejects duplicate declared names even when source names differ', () => {
    expect(() => createConfigFormModuleRegistry({
      './materials/text.ts': { name: 'text', value: 'first' },
      './overrides/text.ts': { name: 'text', value: 'second' },
    })).toThrowError(expect.objectContaining<Partial<ConfigFormModuleRegistryError>>({
      code: 'CONFIG_FORM_MODULE_NAME_DUPLICATE',
      context: {
        name: 'text',
        sources: ['./materials/text.ts', './overrides/text.ts'],
      },
    }))
  })
})
