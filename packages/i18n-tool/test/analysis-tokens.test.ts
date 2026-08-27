import type { TranslationUnit } from '../core'
import { describe, expect, it } from 'vitest'
import {
  analyzeTranslationGaps,
  extractProtectedTokens,
  i18nextJsonAdapter,
  planTranslationBatches,
  protectedTokensEqual,
} from '../core'

function units(content: string, locale: string, resourceId: string): TranslationUnit[] {
  return [...i18nextJsonAdapter.parse({
    adapterOptions: {
      contexts: ['female', 'male'],
      pluralForms: ['one', 'other'],
    },
    content,
    keyStyle: 'flat',
    layout: 'locale-per-file',
    locale,
    namespace: 'common',
    relativePath: `locales/${locale}/common.json`,
    resourceId,
  }).document!.units]
}

describe('translation gap analysis', () => {
  it('distinguishes missing, empty and existing targets', () => {
    const source = units('{"a":"A","b":"B","c":"C"}', 'en', 'en-common')
    const target = units('{"a":"","b":"译文"}', 'zh-CN', 'zh-common')

    expect(analyzeTranslationGaps(source, target, 'zh-CN').map(gap => [gap.source.sourceKey, gap.status])).toEqual([
      ['a', 'empty'],
      ['b', 'existing'],
      ['c', 'missing'],
    ])
  })
})

describe('protected tokens', () => {
  it('extracts interpolation, printf, escaped newline, links, plural pipes and tags', () => {
    const value = '<strong>{name}</strong> {{count}} %1$s\\n@:common.ok | items'
    expect(extractProtectedTokens(value).map(token => token.kind)).toEqual([
      'html-tag',
      'vue',
      'html-tag',
      'i18next',
      'printf',
      'escaped-newline',
      'vue-linked',
      'plural-pipe',
    ])
  })

  it('compares token multisets including duplicates', () => {
    expect(protectedTokensEqual('{name} {name}', '{name} {name}')).toBe(true)
    expect(protectedTokensEqual('{name} {name}', '{name}')).toBe(false)
    expect(protectedTokensEqual('<b>{name}</b>', '<i>{name}</i>')).toBe(false)
  })

  it('protects complete HTML tags when quoted attributes contain greater-than characters', () => {
    const source = '<a title="1 > 0">Go</a><br />'
    expect(extractProtectedTokens(source).filter(token => token.kind === 'html-tag')).toEqual([
      { kind: 'html-tag', value: '<a title="1 > 0">' },
      { kind: 'html-tag', value: '</a>' },
      { kind: 'html-tag', value: '<br />' },
    ])
    expect(protectedTokensEqual(source, '<a title="1 > 0">Aller</a><br />')).toBe(true)
    expect(protectedTokensEqual(source, '<a title="1">Aller</a><br />')).toBe(false)
  })
})

describe('batch planning', () => {
  it('keeps plural/context families in one batch', () => {
    const family = units('{"friend_male_one":"one","friend_male_other":"other"}', 'en', 'en-common')
    const single = units('{"plain":"plain"}', 'en', 'en-other')
    const plan = planTranslationBatches([...family, ...single], { maxCharacters: 20, maxUnits: 2 })

    expect(plan.diagnostics).toEqual([])
    expect(plan.batches).toHaveLength(2)
    expect(plan.batches[0].units.map(unit => unit.sourceKey)).toEqual(['friend_male_one', 'friend_male_other'])
  })

  it('rejects a family that cannot fit without splitting', () => {
    const family = units('{"friend_male_one":"one","friend_male_other":"other"}', 'en', 'en-common')
    const plan = planTranslationBatches(family, { maxCharacters: 100, maxUnits: 1 })
    expect(plan.batches).toEqual([])
    expect(plan.diagnostics).toContainEqual(expect.objectContaining({ code: 'BATCH_LIMIT_EXCEEDED' }))
  })

  it('does not merge equal family semantics across resources or locales', () => {
    const first = units('{"item_one":"one","item_other":"other"}', 'en', 'resource-a')
    const second = units('{"item_one":"un","item_other":"plusieurs"}', 'fr', 'resource-b')
    const plan = planTranslationBatches([...first, ...second], { maxCharacters: 1_000, maxUnits: 10 })

    expect(plan.diagnostics).toEqual([])
    expect(plan.batches).toHaveLength(2)
    expect(plan.batches.map(batch => new Set(batch.units.map(unit => unit.origin.resourceId)).size)).toEqual([1, 1])
  })
})
