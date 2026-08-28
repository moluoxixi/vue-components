import type { SanitizedConfigResponse, ScanResponse } from '../protocol'
import { describe, expect, it } from 'vitest'
import { createInitialState, reduceWorkbenchState } from '../src/ui/state'

const config: SanitizedConfigResponse = {
  ai: {
    baseUrl: 'https://up.example/v1',
    model: 'model',
    provider: 'openai-compatible',
    status: 'configured',
  },
  projectName: 'fixture',
  resources: {
    adapter: 'vue-i18n-json',
    exclude: [],
    include: ['locales/**/*.json'],
    keyStyle: 'nested',
    layout: 'locale-per-file',
    localePattern: 'locales/{locale}.json',
    sourceLocale: 'en-US',
    targetLocales: ['zh-CN', 'fr-FR'],
  },
}

const scan: ScanResponse = {
  diagnostics: [],
  gaps: {
    'fr-FR': { empty: 0, existing: 0, missing: 2 },
    'zh-CN': { empty: 1, existing: 1, missing: 0 },
  },
  resources: [],
  scanId: '00000000-0000-4000-8000-000000000001',
  unitGaps: [
    { sourceUnitId: 'a', status: 'empty', targetLocale: 'zh-CN', targetUnitId: 'ta' },
    { sourceUnitId: 'b', status: 'existing', targetLocale: 'zh-CN', targetUnitId: 'tb' },
    { sourceUnitId: 'a', status: 'missing', targetLocale: 'fr-FR' },
    { sourceUnitId: 'b', status: 'missing', targetLocale: 'fr-FR' },
  ],
  units: [],
}

describe('workbench reducer', () => {
  it('selects only missing and empty units for the active target', () => {
    let state = reduceWorkbenchState(createInitialState(), { config, type: 'config/success' })
    state = reduceWorkbenchState(state, { scan, type: 'scan/success' })
    expect(state.targetLocale).toBe('zh-CN')
    expect(state.selectedUnitIds).toEqual(['a'])

    state = reduceWorkbenchState(state, { locale: 'fr-FR', type: 'target/set' })
    expect(state.selectedUnitIds).toEqual(['a', 'b'])
  })

  it('keeps candidates stable across views and blocks invalid acceptance', () => {
    let state = reduceWorkbenchState(createInitialState(), {
      candidate: { sourceUnitId: 'a', targetLocale: 'zh-CN', value: '你好 {name}' },
      type: 'translation/candidate',
      valid: true,
    })
    state = reduceWorkbenchState(state, { type: 'view/set', view: 'resources' })
    state = reduceWorkbenchState(state, { sourceUnitId: 'a', type: 'candidate/edit', valid: false, value: '你好' })
    state = reduceWorkbenchState(state, { accepted: true, sourceUnitId: 'a', type: 'candidate/accept' })

    expect(state.candidates[0]).toMatchObject({ accepted: false, valid: false, value: '你好' })
  })

  it('moves a valid preview to changes and resets after apply', () => {
    let state = reduceWorkbenchState(createInitialState(), {
      preview: { diagnostics: [], files: [], previewToken: '00000000-0000-4000-8000-000000000010' },
      type: 'preview/success',
    })
    expect(state.activeView).toBe('changes')
    expect(state.previewStatus).toBe('ready')

    state = reduceWorkbenchState(state, { scan, type: 'apply/success' })
    expect(state.preview).toBeUndefined()
    expect(state.scan).toBe(scan)
    expect(state.applyStatus).toBe('ready')
  })

  it('invalidates preview tokens after candidate changes or stale apply errors', () => {
    let state = reduceWorkbenchState(createInitialState(), {
      candidate: { sourceUnitId: 'a', targetLocale: 'zh-CN', value: 'candidate' },
      type: 'translation/candidate',
      valid: true,
    })
    state = reduceWorkbenchState(state, {
      preview: { diagnostics: [], files: [], previewToken: '00000000-0000-4000-8000-000000000010' },
      type: 'preview/success',
    })
    state = reduceWorkbenchState(state, {
      sourceUnitId: 'a',
      type: 'candidate/edit',
      valid: true,
      value: 'edited',
    })
    expect(state.preview).toBeUndefined()
    expect(state.previewStatus).toBe('idle')

    state = reduceWorkbenchState(state, {
      preview: { diagnostics: [], files: [], previewToken: '00000000-0000-4000-8000-000000000011' },
      type: 'preview/success',
    })
    state = reduceWorkbenchState(state, {
      code: 'PREVIEW_STALE',
      message: 'stale',
      type: 'apply/error',
    })
    expect(state.preview).toBeUndefined()
    expect(state.previewStatus).toBe('error')
    expect(state.activeView).toBe('translate')
  })
})
