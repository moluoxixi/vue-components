import type { ProviderConfig } from '@moluoxixi/ai-provider/server'
import type { ChatTransport, TranslationBatch } from '../core'
import { describe, expect, it, vi } from 'vitest'
import {
  createTranslationRequest,
  i18nextJsonAdapter,
  selectRetryUnits,
  translateBatch,
  validateTranslationOutput,
  vueI18nJsonAdapter,
} from '../core'

const providerConfig: ProviderConfig = {
  chatApiKey: 'secret',
  chatBaseUrl: 'https://up.example/v1',
  chatModel: 'model',
  embeddingApiKey: '',
  embeddingBaseUrl: 'https://up.example/v1',
  embeddingModel: 'embedding',
}

function vueBatch(): TranslationBatch {
  const units = vueI18nJsonAdapter.parse({
    content: '{"hello":"Hello {name}","plain":"Plain"}',
    keyStyle: 'flat',
    layout: 'locale-per-file',
    locale: 'en-US',
    relativePath: 'locales/en-US.json',
    resourceId: 'en-US',
  }).document!.units
  return { id: 'batch', units }
}

function i18nextBatch(): TranslationBatch {
  const units = i18nextJsonAdapter.parse({
    adapterOptions: { contexts: ['male'], pluralForms: ['one', 'other'] },
    content: '{"friend_male_one":"{{name}} has one","friend_male_other":"{{name}} has {{count}}"}',
    keyStyle: 'flat',
    layout: 'locale-per-file',
    locale: 'en',
    namespace: 'common',
    relativePath: 'locales/en/common.json',
    resourceId: 'en-common',
  }).document!.units
  return { id: 'family', units }
}

describe('model output validation', () => {
  it('accepts exact IDs, locale and protected tokens', () => {
    const batch = vueBatch()
    const result = validateTranslationOutput({
      targetLocale: 'zh-CN',
      translations: [
        { id: batch.units[0].id, value: '你好 {name}' },
        { id: batch.units[1].id, value: '普通' },
      ],
    }, batch.units, 'zh-CN')

    expect(result.ok).toBe(true)
    expect(result.candidates).toHaveLength(2)
    expect(createTranslationRequest(batch, 'zh-CN').entries[0].protectedTokens)
      .toEqual([{ kind: 'vue', value: '{name}' }])
  })

  it('rejects invalid JSON, schema and target locale', () => {
    const batch = vueBatch()
    expect(validateTranslationOutput('not-json', batch.units, 'zh-CN').diagnostics[0].code)
      .toBe('MODEL_OUTPUT_INVALID')
    expect(validateTranslationOutput({ translations: [] }, batch.units, 'zh-CN').diagnostics[0].code)
      .toBe('MODEL_OUTPUT_INVALID')
    expect(validateTranslationOutput({ targetLocale: 'fr', translations: [] }, batch.units, 'zh-CN').diagnostics[0].code)
      .toBe('TARGET_LOCALE_MISMATCH')
  })

  it('rejects unknown, duplicate, missing and token-drifting results', () => {
    const batch = vueBatch()
    const result = validateTranslationOutput({
      targetLocale: 'zh-CN',
      translations: [
        { id: 'unknown', value: 'x' },
        { id: batch.units[0].id, value: '缺少占位符' },
        { id: batch.units[0].id, value: '你好 {name}' },
      ],
    }, batch.units, 'zh-CN')

    expect(result.ok).toBe(false)
    expect(result.candidates).toEqual([])
    expect(new Set(result.diagnostics.map(item => item.code))).toEqual(new Set([
      'DUPLICATE_RESULT',
      'MISSING_RESULT',
      'TOKEN_MISMATCH',
      'UNEXPECTED_RESULT',
    ]))
  })

  it('invalidates an entire plural/context family when one member fails', () => {
    const batch = i18nextBatch()
    const result = validateTranslationOutput({
      targetLocale: 'zh-CN',
      translations: [
        { id: batch.units[0].id, value: '{{name}} 有一位朋友' },
      ],
    }, batch.units, 'zh-CN')

    expect(result.candidates).toEqual([])
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FAMILY_INCOMPLETE' }))
    expect(selectRetryUnits(batch.units, result)).toHaveLength(2)
  })

  it('retries all expected units when the only failure is an unexpected ID', () => {
    const batch = vueBatch()
    const result = validateTranslationOutput({
      targetLocale: 'zh-CN',
      translations: [
        ...batch.units.map(unit => ({ id: unit.id, value: unit.sourceKey === 'hello' ? '你好 {name}' : '普通' })),
        { id: 'unexpected', value: 'extra' },
      ],
    }, batch.units, 'zh-CN')

    expect(result.ok).toBe(false)
    expect(selectRetryUnits(batch.units, result)).toEqual(batch.units)
  })
})

describe('translateBatch', () => {
  it('sends the structured request and validates the collected response', async () => {
    const batch = vueBatch()
    const chat = vi.fn<ChatTransport>(async function* (_config, messages) {
      const request = JSON.parse(messages[1].content)
      yield JSON.stringify({
        targetLocale: request.targetLocale,
        translations: request.entries.map((entry: { id: string, source: string }) => ({
          id: entry.id,
          value: entry.source === 'Plain' ? '普通' : '你好 {name}',
        })),
      })
    })

    const result = await translateBatch(providerConfig, batch, 'zh-CN', undefined, chat)
    expect(result.ok).toBe(true)
    expect(chat).toHaveBeenCalledOnce()
    expect(chat.mock.calls[0][1][0]).toMatchObject({ role: 'system' })
  })

  it('preserves AbortError before contacting the model', async () => {
    const controller = new AbortController()
    controller.abort()
    const chat = vi.fn<ChatTransport>()

    await expect(translateBatch(providerConfig, vueBatch(), 'zh-CN', controller.signal, chat))
      .rejects
      .toMatchObject({ name: 'AbortError' })
    expect(chat).not.toHaveBeenCalled()
  })
})
