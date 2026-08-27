import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createLocaleAdapterRegistry,
  defaultLocaleAdapterRegistry,
  genericJsonAdapter,
  i18nextJsonAdapter,
  vueI18nJsonAdapter,
} from '../core'

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

describe('vue I18n JSON adapter', () => {
  it('keeps nested paths distinct from flat dotted keys', () => {
    const nested = vueI18nJsonAdapter.parse({
      content: fixture('vue-nested-en.json'),
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'nested-en',
    })
    const flat = vueI18nJsonAdapter.parse({
      content: fixture('vue-flat-en.json'),
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'flat-en',
    })

    expect(nested.diagnostics).toEqual([])
    expect(nested.document?.units[0].path).toEqual(['common', 'hello'])
    expect(flat.diagnostics).toEqual([])
    expect(flat.document?.units[0].path).toEqual(['common.hello'])
    expect(nested.document?.units[0].id).not.toBe(flat.document?.units[0].id)
  })

  it('diagnoses nested and literal dotted key ambiguity', () => {
    const result = vueI18nJsonAdapter.parse({
      content: JSON.stringify({ 'a': { b: 'nested' }, 'a.b': 'literal' }),
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'ambiguous-en',
    })

    expect(result.document?.units).toHaveLength(2)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'AMBIGUOUS_KEY' }))
  })

  it('rejects mixed flat objects and unsupported leaves', () => {
    const flat = vueI18nJsonAdapter.parse({
      content: JSON.stringify({ nested: { value: 'bad' } }),
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'mixed-en',
    })
    const nested = vueI18nJsonAdapter.parse({
      content: JSON.stringify({ count: 1, list: ['bad'], nil: null }),
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'unsupported-en',
    })

    expect(flat.diagnostics).toContainEqual(expect.objectContaining({ code: 'MIXED_KEY_STYLE' }))
    expect(nested.diagnostics.filter(item => item.code === 'UNSUPPORTED_LEAF')).toHaveLength(3)
  })
})

describe('generic JSON adapter', () => {
  it('reads every locale from a locale-first document', () => {
    const result = genericJsonAdapter.parse({
      content: fixture('generic-locale-first.json'),
      layout: 'locale-first',
      relativePath: 'src/i18n/translation.json',
      resourceId: 'translations',
    })

    expect(result.diagnostics).toEqual([])
    expect(result.document?.format.rootKeyOrder).toEqual(['en-US', 'zh-CN'])
    expect(result.document?.units.map(unit => [unit.locale, unit.path.join('.')])).toEqual([
      ['en-US', 'select-language'],
      ['en-US', 'title'],
      ['zh-CN', 'select-language'],
    ])
  })

  it('requires an explicit locale for locale-per-file resources', () => {
    const result = genericJsonAdapter.parse({
      content: '{}',
      layout: 'locale-per-file',
      relativePath: 'locales/en.json',
      resourceId: 'missing-locale',
    })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'LOCALE_REQUIRED' }))
  })
})

describe('i18next JSON adapter', () => {
  it('preserves namespace, context and plural family semantics', () => {
    const result = i18nextJsonAdapter.parse({
      adapterOptions: {
        contexts: ['female', 'male'],
        pluralForms: ['one', 'other'],
      },
      content: fixture('i18next-common-en.json'),
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en',
      namespace: 'common',
      relativePath: 'locales/en/common.json',
      resourceId: 'en-common',
    })

    expect(result.diagnostics).toEqual([])
    const units = result.document!.units
    expect(new Set(units.map(unit => unit.semantics.family)).size).toBe(1)
    expect(units[0]).toMatchObject({
      namespace: 'common',
      semantics: { context: 'male', pluralForm: 'one' },
      sourceKey: 'friend_male_one',
    })
    expect(units.map(unit => unit.sourceKey)).toEqual([
      'friend_male_one',
      'friend_male_other',
      'friend_female_one',
      'friend_female_other',
    ])
  })

  it('keeps unknown suffixes opaque', () => {
    const result = i18nextJsonAdapter.parse({
      content: '{"friend_custom":"value","status_other":"opaque"}',
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en',
      namespace: 'common',
      relativePath: 'locales/en/common.json',
      resourceId: 'opaque-en',
    })
    expect(result.document?.units.every(unit => unit.semantics.family === undefined)).toBe(true)
  })

  it('keeps family semantics stable across resources and locales', () => {
    const parse = (resourceId: string, locale: string) => i18nextJsonAdapter.parse({
      adapterOptions: { pluralForms: ['one', 'other'] },
      content: '{"item_one":"one","item_other":"other"}',
      keyStyle: 'flat' as const,
      layout: 'locale-per-file' as const,
      locale,
      namespace: 'common',
      relativePath: `${locale}/common.json`,
      resourceId,
    }).document!.units[0].semantics.family

    expect(parse('resource-a', 'en')).toBe(parse('resource-b', 'en'))
    expect(parse('resource-a', 'en')).toBe(parse('resource-a', 'fr'))
  })

  it('rejects a target namespace change', () => {
    const source = i18nextJsonAdapter.parse({
      content: '{"key":"value"}',
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en',
      namespace: 'common',
      relativePath: 'locales/en/common.json',
      resourceId: 'en-common',
    }).document!

    expect(i18nextJsonAdapter.planTarget(source, 'fr', {
      namespace: 'other',
      relativePath: 'locales/fr/other.json',
      resourceId: 'fr-other',
    }).diagnostics).toContainEqual(expect.objectContaining({ code: 'TARGET_PLAN_INVALID' }))
  })
})

it('registry reports missing adapters without throwing', () => {
  const registry = createLocaleAdapterRegistry([])
  expect(registry.require('generic-json')).toMatchObject({
    diagnostics: [expect.objectContaining({ code: 'ADAPTER_NOT_FOUND' })],
  })
  expect(defaultLocaleAdapterRegistry.list().map(adapter => adapter.id)).toEqual([
    'generic-json',
    'i18next-json',
    'vue-i18n-json',
  ])
})
