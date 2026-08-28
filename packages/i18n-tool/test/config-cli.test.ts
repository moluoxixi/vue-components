import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseCliArgs } from '../cli'
import {
  findConfigPath,
  loadI18nToolConfig,
  resolveI18nToolConfig,
} from '../config'

const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = resolve(tmpdir(), `i18n-tool-config-${crypto.randomUUID()}`)
  temporaryDirectories.push(directory)
  await mkdir(directory, { recursive: true })
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('config resolution', () => {
  it('applies defaults and CLI precedence', async () => {
    const root = await temporaryDirectory()
    const overrideRoot = resolve(root, 'project')
    const config = resolveI18nToolConfig({
      ai: { apiKeyEnv: 'TEST_AI_KEY', model: 'gpt-test', provider: 'openai' },
      resources: {
        adapter: 'vue-i18n-json',
        layout: 'locale-per-file',
        localePattern: 'locales/{locale}.json',
        sourceLocale: 'en-US',
        targetLocales: ['zh-CN'],
      },
    }, {
      cli: { host: '0.0.0.0', open: false, port: 6_000, root: 'project' },
      configPath: resolve(root, 'i18n-tool.config.ts'),
      cwd: root,
    })

    expect(config.root).toBe(overrideRoot)
    expect(config.server).toEqual({ host: '0.0.0.0', open: false, port: 6_000 })
    expect(config.resources.include).toEqual(['locales/**/*.json'])
    expect(config.ai).toEqual({ apiKeyEnv: 'TEST_AI_KEY', model: 'gpt-test', provider: 'openai' })
  })

  it.each([
    { apiKeyEnv: 'OPENAI_API_KEY', model: 'gpt-5-mini', provider: 'openai' },
    { apiKeyEnv: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-4-5', provider: 'anthropic' },
    { apiKeyEnv: 'GOOGLE_API_KEY', model: 'gemini-2.5-flash', provider: 'google' },
    {
      apiKeyEnv: 'COMPATIBLE_API_KEY',
      baseUrl: 'https://gateway.example/v1',
      model: 'compatible-model',
      provider: 'openai-compatible',
    },
  ] as const)('accepts explicit $provider configuration', async (ai) => {
    const root = await temporaryDirectory()
    const config = resolveI18nToolConfig({
      ai,
      resources: {
        adapter: 'vue-i18n-json',
        layout: 'locale-per-file',
        localePattern: 'locales/{locale}.json',
        sourceLocale: 'en-US',
        targetLocales: ['zh-CN'],
      },
    }, { configPath: resolve(root, 'i18n-tool.config.ts') })

    expect(config.ai).toEqual(ai)
  })

  it('rejects traversal, duplicate targets and unsupported layouts', async () => {
    const root = await temporaryDirectory()
    const base = {
      ai: {
        apiKeyEnv: 'TEST_AI_KEY',
        baseUrl: 'https://gateway.example/v1',
        model: 'test-model',
        provider: 'openai-compatible',
      },
      resources: {
        adapter: 'vue-i18n-json',
        layout: 'locale-per-file',
        localePattern: 'locales/{locale}.json',
        sourceLocale: 'en-US',
        targetLocales: ['zh-CN'],
      },
    } as const
    const options = { configPath: resolve(root, 'i18n-tool.config.ts') }

    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, include: ['../outside/*.json'] },
    }, options)).toThrow(/relative/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, targetLocales: ['zh-CN', 'zh-CN'] },
    }, options)).toThrow(/unique/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, layout: 'locale-first' },
    }, options)).toThrow(/locale-per-file/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, targetLocales: ['../outside'] },
    }, options)).toThrow(/single path segments/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, targetLocales: ['zh:CN'] },
    }, options)).toThrow(/single path segments/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, targetLocales: ['EN-us'] },
    }, options)).toThrow(/source locale/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, localePattern: 'locales/{locale}/{locale}.json' },
    }, options)).toThrow(/at most once/)
    expect(() => resolveI18nToolConfig({
      ...base,
      resources: { ...base.resources, localePattern: 'locales/{language}.json' },
    }, options)).toThrow(/at most once/)
    expect(() => resolveI18nToolConfig({
      ...base,
      ai: { ...base.ai, baseUrl: 'https://user:secret@example.test/v1?token=value' },
    }, options)).toThrow(/credentials/)
    expect(() => resolveI18nToolConfig({
      ...base,
      ai: { apiKeyEnv: 'TEST_AI_KEY', model: 'test-model', provider: 'openai', baseUrl: 'https://gateway.example/v1' },
    }, options)).toThrow(/unrecognized/i)
    expect(() => resolveI18nToolConfig({
      ...base,
      ai: { apiKeyEnv: 'TEST_AI_KEY', model: 'test-model', provider: 'openai-compatible' },
    }, options)).toThrow()
    expect(() => resolveI18nToolConfig({
      ...base,
      ai: { apiKeyEnv: 'TEST_AI_KEY', model: 'test-model' },
    }, options)).toThrow()
  })

  it('discovers and loads a TypeScript config from a child directory', async () => {
    const root = await temporaryDirectory()
    const child = resolve(root, 'packages/app')
    await mkdir(child, { recursive: true })
    await writeFile(resolve(root, 'i18n-tool.config.ts'), `
const config = {
  ai: {
    apiKeyEnv: 'TEST_AI_KEY',
    model: 'test-model',
    provider: 'google',
  },
  resources: {
    adapter: 'generic-json',
    layout: 'locale-first',
    localePattern: 'translations.json',
    sourceLocale: 'en-US',
    targetLocales: ['zh-CN'],
  },
} as const
export default config
`)

    expect(findConfigPath(child)).toBe(resolve(root, 'i18n-tool.config.ts'))
    const config = await loadI18nToolConfig({ cwd: child })
    expect(config.resources.adapter).toBe('generic-json')
    expect(config.root).toBe(root)
  })
})

describe('cLI parsing', () => {
  it('supports inline and separated strict options', () => {
    expect(parseCliArgs([
      '--config=config.ts',
      '--root',
      'project',
      '--host',
      '0.0.0.0',
      '--port=6000',
      '--open',
    ])).toEqual({
      configPath: 'config.ts',
      help: false,
      host: '0.0.0.0',
      open: true,
      port: 6_000,
      root: 'project',
    })
  })

  it('rejects unknown options and invalid ports', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow(/Unsupported/)
    expect(() => parseCliArgs(['--port', '70000'])).toThrow(/65535/)
    expect(() => parseCliArgs(['--host='])).toThrow(/blank/)
    expect(() => parseCliArgs(['--open='])).toThrow(/blank/)
    expect(parseCliArgs(['--help'])).toEqual({ help: true })
  })
})
