// @vitest-environment happy-dom
import type { PreviewResponse, SanitizedConfigResponse, ScanResponse, TranslateSseEvent } from '../protocol'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../src/ui/api'
import App from '../src/ui/App.vue'

vi.mock('../src/ui/api', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/ui/api')>()),
  applyPreview: vi.fn(),
  createPreview: vi.fn(),
  getConfig: vi.fn(),
  scanWorkspace: vi.fn(),
  streamTranslation: vi.fn(),
}))

const config: SanitizedConfigResponse = {
  ai: {
    baseUrl: 'https://up.example/v1',
    model: 'model',
    provider: 'openai-compatible',
    status: 'configured',
  },
  projectName: 'fixture-project',
  resources: {
    adapter: 'vue-i18n-json',
    exclude: [],
    include: ['locales/**/*.json'],
    keyStyle: 'nested',
    layout: 'locale-per-file',
    localePattern: 'locales/{locale}.json',
    sourceLocale: 'en-US',
    targetLocales: ['zh-CN'],
  },
}

const sourceUnit = {
  id: 'source-unit',
  locale: 'en-US',
  origin: { jsonPointer: '/hello', relativePath: 'locales/en-US.json', resourceId: 'source' },
  path: ['hello'],
  semantics: { adapter: 'vue-i18n-json' as const, keyStyle: 'nested' as const, layout: 'locale-per-file' as const },
  sourceKey: 'hello',
  value: 'Hello {name}',
}

const scan: ScanResponse = {
  diagnostics: [],
  gaps: { 'zh-CN': { empty: 0, existing: 0, missing: 1 } },
  resources: [{
    adapter: 'vue-i18n-json',
    diagnostics: [],
    hash: 'hash',
    keyCount: 1,
    locale: 'en-US',
    relativePath: 'locales/en-US.json',
    resourceId: 'source',
  }],
  scanId: '00000000-0000-4000-8000-000000000001',
  unitGaps: [{ sourceUnitId: sourceUnit.id, status: 'missing', targetLocale: 'zh-CN' }],
  units: [sourceUnit],
}

beforeEach(() => {
  vi.mocked(api.getConfig).mockReset()
  vi.mocked(api.createPreview).mockReset()
  vi.mocked(api.scanWorkspace).mockReset()
  vi.mocked(api.streamTranslation).mockReset()
  vi.mocked(api.getConfig).mockResolvedValue(config)
  vi.mocked(api.scanWorkspace).mockResolvedValue(scan)
  vi.mocked(api.streamTranslation).mockImplementation(async (_request, onEvent) => {
    onEvent({
      candidate: { sourceUnitId: sourceUnit.id, targetLocale: 'zh-CN', value: '你好 {name}' },
      type: 'candidate',
    })
    onEvent({ completed: 1, total: 1, type: 'progress' })
    onEvent({ type: 'done' })
  })
})

it('ignores late translation events after a newer scan starts', async () => {
  let lateEvent!: (event: TranslateSseEvent) => void
  let finishLate!: () => void
  vi.mocked(api.streamTranslation).mockImplementationOnce((_request, onEvent) => {
    lateEvent = onEvent
    return new Promise<void>((resolveLate) => {
      finishLate = resolveLate
    })
  })
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { transition: false } },
  })
  await flushPromises()
  await wrapper.findAll('[role="tab"]').find(item => item.text() === 'Translate')!.trigger('click')
  await wrapper.findAll('button').find(button => button.text().includes('Translate 1'))!.trigger('click')
  await flushPromises()

  await wrapper.get('button[aria-label="Rescan locale resources"]').trigger('click')
  await flushPromises()
  lateEvent({
    candidate: { sourceUnitId: sourceUnit.id, targetLocale: 'zh-CN', value: '迟到 {name}' },
    type: 'candidate',
  })
  finishLate()
  await flushPromises()

  expect(wrapper.find('textarea').exists()).toBe(false)
  expect(wrapper.text()).not.toContain('Translation stopped')
  wrapper.unmount()
})

it('rejects candidates outside the active translation request', async () => {
  vi.mocked(api.streamTranslation).mockImplementationOnce(async (_request, onEvent) => {
    onEvent({
      candidate: { sourceUnitId: sourceUnit.id, targetLocale: 'fr-FR', value: 'Bonjour {name}' },
      type: 'candidate',
    })
  })
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { transition: false } },
  })
  await flushPromises()
  await wrapper.findAll('[role="tab"]').find(item => item.text() === 'Translate')!.trigger('click')
  await wrapper.findAll('button').find(button => button.text().includes('Translate 1'))!.trigger('click')
  await flushPromises()

  expect(wrapper.text()).toContain('outside the current request')
  expect(wrapper.find('textarea').exists()).toBe(false)
  wrapper.unmount()
})

it('ignores a preview response after the candidate changes', async () => {
  let resolvePreview!: (preview: PreviewResponse) => void
  vi.mocked(api.createPreview).mockImplementationOnce(() => new Promise((resolveResult) => {
    resolvePreview = resolveResult
  }))
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: { transition: false } },
  })
  await flushPromises()
  await wrapper.findAll('[role="tab"]').find(item => item.text() === 'Translate')!.trigger('click')
  await wrapper.findAll('button').find(button => button.text().includes('Translate 1'))!.trigger('click')
  await flushPromises()
  await wrapper.findAll('button').find(button => button.text().includes('Preview changes'))!.trigger('click')
  await (wrapper.get('textarea').setValue('编辑后 {name}'))
  resolvePreview({
    diagnostics: [],
    files: [],
    previewToken: '00000000-0000-4000-8000-000000000020',
  })
  await flushPromises()

  expect(wrapper.get('#tab-changes').attributes('aria-disabled')).toBe('true')
  expect(wrapper.get('#panel-translate').isVisible()).toBe(true)
  wrapper.unmount()
})

describe('i18n workbench app', () => {
  it('bootstraps the project and keeps translation state across tabs', async () => {
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [ElementPlus], stubs: { transition: false } },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('fixture-project')
    expect(wrapper.text()).toContain('locales/en-US.json')
    const translateTab = wrapper.findAll('[role="tab"]').find(item => item.text() === 'Translate')!
    await translateTab.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Hello {name}')

    const translateButton = wrapper.findAll('button').find(button => button.text().includes('Translate 1'))!
    await translateButton.trigger('click')
    await flushPromises()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('你好 {name}')

    const resourcesTab = wrapper.findAll('[role="tab"]').find(item => item.text() === 'Resources')!
    await resourcesTab.trigger('click')
    await translateTab.trigger('click')
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('你好 {name}')
    wrapper.unmount()
  })
})
