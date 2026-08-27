import { describe, expect, it } from 'vitest'
import {
  analyzeTranslationGaps,
  applyOperationsAndValidate,
  genericJsonAdapter,
  planChangeOperations,
  vueI18nJsonAdapter,
} from '../core'

describe('locale-per-file operations', () => {
  it('creates a target document and round-trips nested paths', () => {
    const source = vueI18nJsonAdapter.parse({
      content: '{\r\n  "common": {\r\n    "hello": "Hello {name}"\r\n  }\r\n}\r\n',
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'en-US',
    }).document!
    const target = vueI18nJsonAdapter.planTarget(source, 'zh-CN', {
      relativePath: 'locales/zh-CN.json',
      resourceId: 'zh-CN',
    }).document!
    const gaps = analyzeTranslationGaps(source.units, target.units, 'zh-CN')
    const plan = planChangeOperations(vueI18nJsonAdapter, source, gaps, [{
      sourceUnitId: source.units[0].id,
      targetLocale: 'zh-CN',
      value: '你好 {name}',
    }], { targetLocale: 'zh-CN', targetResourceId: target.resourceId })

    expect(plan.diagnostics).toEqual([])
    expect(plan.operations[0]).toMatchObject({
      jsonPointer: '/common/hello',
      type: 'create',
    })
    const result = applyOperationsAndValidate(vueI18nJsonAdapter, target, plan.operations)
    expect(result.diagnostics).toEqual([])
    expect(result.content).toBe('{\r\n  "common": {\r\n    "hello": "你好 {name}"\r\n  }\r\n}\r\n')
    expect(result.document?.units[0].value).toBe('你好 {name}')
  })

  it('requires explicit overwrite approval and detects stale baselines', () => {
    const source = vueI18nJsonAdapter.parse({
      content: '{"hello":"Hello"}',
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'en-US',
      relativePath: 'locales/en-US.json',
      resourceId: 'en-US',
    }).document!
    const target = vueI18nJsonAdapter.parse({
      content: '{"hello":"旧译文"}',
      keyStyle: 'flat',
      layout: 'locale-per-file',
      locale: 'zh-CN',
      relativePath: 'locales/zh-CN.json',
      resourceId: 'zh-CN',
    }).document!
    const gaps = analyzeTranslationGaps(source.units, target.units, 'zh-CN')
    const candidate = [{ sourceUnitId: source.units[0].id, targetLocale: 'zh-CN', value: '新译文' }]

    expect(planChangeOperations(vueI18nJsonAdapter, source, gaps, candidate, {
      targetLocale: 'zh-CN',
      targetResourceId: target.resourceId,
    }).diagnostics).toContainEqual(expect.objectContaining({ code: 'OVERWRITE_REQUIRED' }))

    const approved = planChangeOperations(vueI18nJsonAdapter, source, gaps, candidate, {
      allowOverwrite: true,
      targetLocale: 'zh-CN',
      targetResourceId: target.resourceId,
    })
    const stale = approved.operations.map(operation => ({ ...operation, before: 'external edit' }))
    expect(applyOperationsAndValidate(vueI18nJsonAdapter, target, stale).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'ROUND_TRIP_MISMATCH' }))

    const crossResource = approved.operations.map(operation => ({ ...operation, resourceId: 'other' }))
    expect(applyOperationsAndValidate(vueI18nJsonAdapter, target, crossResource).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'ROUND_TRIP_MISMATCH' }))

    const wrongLocale = approved.operations.map(operation => ({ ...operation, targetLocale: 'fr-FR' }))
    expect(applyOperationsAndValidate(vueI18nJsonAdapter, target, wrongLocale).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'ROUND_TRIP_MISMATCH' }))

    const wrongPointer = approved.operations.map(operation => ({ ...operation, jsonPointer: '/wrong' }))
    expect(applyOperationsAndValidate(vueI18nJsonAdapter, target, wrongPointer).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'ROUND_TRIP_MISMATCH' }))

    expect(applyOperationsAndValidate(genericJsonAdapter, target, approved.operations).diagnostics)
      .toContainEqual(expect.objectContaining({ code: 'ROUND_TRIP_MISMATCH' }))
  })
})

describe('locale-first operations', () => {
  it('adds a target locale branch without changing existing locales', () => {
    const document = genericJsonAdapter.parse({
      content: '{\n  "en-US": { "title": "Docs" },\n  "zh-CN": { "title": "文档" }\n}\n',
      layout: 'locale-first',
      relativePath: 'translations.json',
      resourceId: 'translations',
    }).document!
    expect(genericJsonAdapter.planTarget(document, 'fr-FR', {
      relativePath: 'other.json',
      resourceId: 'other',
    }).diagnostics).toContainEqual(expect.objectContaining({ code: 'TARGET_PLAN_INVALID' }))
    const target = genericJsonAdapter.planTarget(document, 'fr-FR', {
      relativePath: document.relativePath,
      resourceId: document.resourceId,
    }).document!
    const sourceUnits = document.units.filter(unit => unit.locale === 'en-US')
    const gaps = analyzeTranslationGaps(sourceUnits, target.units, 'fr-FR')
    const plan = planChangeOperations(genericJsonAdapter, target, gaps, [{
      sourceUnitId: sourceUnits[0].id,
      targetLocale: 'fr-FR',
      value: 'Documentation',
    }], { targetLocale: 'fr-FR', targetResourceId: target.resourceId })

    expect(plan.operations[0].jsonPointer).toBe('/fr-FR/title')
    const result = applyOperationsAndValidate(genericJsonAdapter, target, plan.operations)
    expect(result.diagnostics).toEqual([])
    expect(result.document?.units.find(unit => unit.locale === 'fr-FR')?.value).toBe('Documentation')
    expect(result.document?.units.find(unit => unit.locale === 'zh-CN')?.value).toBe('文档')
    expect(result.document?.format).toMatchObject({
      eol: '\n',
      indent: '  ',
      trailingNewline: true,
    })
  })
})
