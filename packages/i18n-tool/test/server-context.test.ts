import type { ChatTransport, TranslationCandidate } from '../core'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nToolError, ServerContext, writeTextAtomically } from '../server'
import { testConfig } from './server-helpers'

const temporaryDirectories: string[] = []

async function localeProject(targetValue?: string): Promise<string> {
  const root = resolve(tmpdir(), `i18n-tool-context-${crypto.randomUUID()}`)
  temporaryDirectories.push(root)
  await mkdir(resolve(root, 'locales'), { recursive: true })
  await writeFile(resolve(root, 'locales/en-US.json'), '{\n  "hello": "Hello {name}",\n  "plain": "Plain"\n}\n')
  if (targetValue !== undefined) {
    await writeFile(
      resolve(root, 'locales/zh-CN.json'),
      `{\n  "hello": ${JSON.stringify(targetValue)}\n}\n`,
    )
  }
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

function translatingChat(): ChatTransport {
  return vi.fn<ChatTransport>(async function* (_config, messages) {
    const request = JSON.parse(messages[1].content)
    yield JSON.stringify({
      targetLocale: request.targetLocale,
      translations: request.entries.map((entry: { id: string, source: string }) => ({
        id: entry.id,
        value: entry.source === 'Plain' ? '普通' : '你好 {name}',
      })),
    })
  })
}

async function translatedCandidates(context: ServerContext, scanId: string, unitIds: string[]): Promise<TranslationCandidate[]> {
  const candidates: TranslationCandidate[] = []
  for await (const event of context.translate({ scanId, targetLocale: 'zh-CN', unitIds })) {
    if (event.type === 'candidate')
      candidates.push(event.candidate)
  }
  return candidates
}

describe('serverContext local workflow', () => {
  it('completes scan, translate, preview and atomic apply for a new locale file', async () => {
    const root = await localeProject()
    const context = new ServerContext({
      chat: translatingChat(),
      config: testConfig(root),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })

    expect(context.sanitizedConfig().ai.status).toBe('configured')
    expect(JSON.stringify(context.sanitizedConfig())).not.toContain('secret-value')
    const scan = await context.scan()
    const sourceIds = scan.units.filter(unit => unit.locale === 'en-US').map(unit => unit.id)
    const candidates = await translatedCandidates(context, scan.scanId, sourceIds)
    expect(candidates).toHaveLength(2)

    const preview = await context.preview({
      allowOverwriteUnitIds: [],
      candidates,
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })
    expect(preview.previewToken).toEqual(expect.any(String))
    expect(preview.files).toHaveLength(1)
    expect(preview.files[0]).toMatchObject({ relativePath: 'locales/zh-CN.json', type: 'create' })

    const applied = await context.apply(preview.previewToken!)
    expect(applied.filesWritten).toBe(1)
    expect(await readFile(resolve(root, 'locales/zh-CN.json'), 'utf8')).toContain('你好 {name}')
    await expect(context.apply(preview.previewToken!)).rejects.toMatchObject({ code: 'PREVIEW_REQUIRED' })
  })

  it('rejects stale scans before preview', async () => {
    const root = await localeProject()
    const context = new ServerContext({
      chat: translatingChat(),
      config: testConfig(root),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })
    const scan = await context.scan()
    const source = scan.units.filter(unit => unit.locale === 'en-US')
    const candidates = await translatedCandidates(context, scan.scanId, source.map(unit => unit.id))
    await writeFile(resolve(root, 'locales/en-US.json'), '{"external":"edit"}')

    await expect(context.preview({
      allowOverwriteUnitIds: [],
      candidates,
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })).rejects.toMatchObject({ code: 'PREVIEW_STALE' })
  })

  it('rejects unconfigured preview locales and candidate locale mismatches', async () => {
    const root = await localeProject()
    const context = new ServerContext({
      chat: translatingChat(),
      config: testConfig(root),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })
    const scan = await context.scan()
    const source = scan.units.find(unit => unit.locale === 'en-US')!
    const candidate = { sourceUnitId: source.id, targetLocale: 'zh-CN', value: '你好 {name}' }

    await expect(context.preview({
      allowOverwriteUnitIds: [],
      candidates: [candidate],
      scanId: scan.scanId,
      targetLocale: '../outside',
    })).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(context.preview({
      allowOverwriteUnitIds: [],
      candidates: [{ ...candidate, targetLocale: 'fr-FR' }],
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })

  it('rejects a preview whose resulting workspace would exceed limits', async () => {
    const root = await localeProject()
    const context = new ServerContext({
      chat: translatingChat(),
      config: testConfig(root, { limits: { keys: 2 } }),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })
    const scan = await context.scan()
    const source = scan.units.filter(unit => unit.locale === 'en-US')
    const candidates = await translatedCandidates(context, scan.scanId, source.map(unit => unit.id))

    await expect(context.preview({
      allowOverwriteUnitIds: [],
      candidates,
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' })
  })

  it('requires per-unit approval before overwriting an existing translation', async () => {
    const root = await localeProject('旧译文 {name}')
    const context = new ServerContext({
      chat: translatingChat(),
      config: testConfig(root),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })
    const scan = await context.scan()
    const hello = scan.units.find(unit => unit.locale === 'en-US' && unit.sourceKey === 'hello')!
    const candidates = await translatedCandidates(context, scan.scanId, [hello.id])

    const blocked = await context.preview({
      allowOverwriteUnitIds: [],
      candidates,
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })
    expect(blocked.previewToken).toBeUndefined()
    expect(blocked.diagnostics).toContainEqual(expect.objectContaining({ code: 'OVERWRITE_REQUIRED' }))

    const approved = await context.preview({
      allowOverwriteUnitIds: [hello.id],
      candidates,
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })
    expect(approved.previewToken).toEqual(expect.any(String))
  })

  it('preserves cancellation before an AI request starts', async () => {
    const root = await localeProject()
    const chat = vi.fn<ChatTransport>()
    const context = new ServerContext({
      chat,
      config: testConfig(root),
      env: { TEST_I18N_AI_KEY: 'secret-value' },
    })
    const scan = await context.scan()
    const sourceId = scan.units.find(unit => unit.locale === 'en-US')!.id
    const controller = new AbortController()
    controller.abort()

    await expect(context.translate({
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
      unitIds: [sourceId],
    }, controller.signal).next()).rejects.toMatchObject({ name: 'AbortError' })
    expect(chat).not.toHaveBeenCalled()
  })

  it('expands a selected i18next member to its complete family before translation', async () => {
    const root = resolve(tmpdir(), `i18n-tool-family-${crypto.randomUUID()}`)
    temporaryDirectories.push(root)
    await mkdir(resolve(root, 'locales/en'), { recursive: true })
    await writeFile(resolve(root, 'locales/en/common.json'), JSON.stringify({
      item_one: 'One item',
      item_other: '{{count}} items',
    }))
    const config = testConfig(root, {
      resources: {
        adapter: 'i18next-json',
        adapterOptions: { pluralForms: ['one', 'other'] },
        exclude: [],
        include: ['locales/**/*.json'],
        keyStyle: 'flat',
        layout: 'locale-per-file',
        localePattern: 'locales/{locale}/{namespace}.json',
        namespace: 'common',
        sourceLocale: 'en',
        targetLocales: ['zh-CN'],
      },
    })
    const chat = vi.fn<ChatTransport>(async function* (_provider, messages) {
      const request = JSON.parse(messages[1].content)
      expect(request.entries).toHaveLength(2)
      yield JSON.stringify({
        targetLocale: 'zh-CN',
        translations: request.entries.map((entry: { id: string, source: string }) => ({
          id: entry.id,
          value: entry.source === 'One item' ? '一个项目' : '{{count}} 个项目',
        })),
      })
    })
    const context = new ServerContext({ chat, config, env: { TEST_I18N_AI_KEY: 'secret-value' } })
    const scan = await context.scan()
    const selected = scan.units.find(unit => unit.sourceKey === 'item_one')!
    const candidates = await translatedCandidates(context, scan.scanId, [selected.id])

    expect(candidates).toHaveLength(2)
    expect(chat).toHaveBeenCalledOnce()
  })

  it('rolls back earlier files when a later file fails and keeps the preview reusable', async () => {
    const root = resolve(tmpdir(), `i18n-tool-transaction-${crypto.randomUUID()}`)
    temporaryDirectories.push(root)
    await mkdir(resolve(root, 'features'), { recursive: true })
    const firstPath = resolve(root, 'features/a.json')
    const secondPath = resolve(root, 'features/b.json')
    const firstBefore = '{"en-US":{"title":"First"}}\n'
    const secondBefore = '{"en-US":{"title":"Second"}}\n'
    await writeFile(firstPath, firstBefore)
    await writeFile(secondPath, secondBefore)
    const config = testConfig(root, {
      resources: {
        adapter: 'generic-json',
        exclude: [],
        include: ['features/**/*.json'],
        keyStyle: 'nested',
        layout: 'locale-first',
        localePattern: 'translations.json',
        sourceLocale: 'en-US',
        targetLocales: ['zh-CN'],
      },
    })
    let writes = 0
    const writeText: typeof writeTextAtomically = async (path, content, options) => {
      writes += 1
      if (writes === 2)
        throw new I18nToolError('WRITE_FAILED', 'Injected second-file failure.')
      await writeTextAtomically(path, content, options)
    }
    const context = new ServerContext({ config, env: { TEST_I18N_AI_KEY: 'secret-value' }, writeText })
    const scan = await context.scan()
    const source = scan.units.filter(unit => unit.locale === 'en-US')
    const preview = await context.preview({
      allowOverwriteUnitIds: [],
      candidates: source.map((unit, index) => ({
        sourceUnitId: unit.id,
        targetLocale: 'zh-CN',
        value: index === 0 ? '第一' : '第二',
      })),
      scanId: scan.scanId,
      targetLocale: 'zh-CN',
    })

    await expect(context.apply(preview.previewToken!)).rejects.toMatchObject({ code: 'WRITE_FAILED' })
    expect(await readFile(firstPath, 'utf8')).toBe(firstBefore)
    expect(await readFile(secondPath, 'utf8')).toBe(secondBefore)

    await expect(context.apply(preview.previewToken!)).resolves.toMatchObject({ filesWritten: 2 })
    expect(await readFile(firstPath, 'utf8')).toContain('第一')
    expect(await readFile(secondPath, 'utf8')).toContain('第二')
  })
})
