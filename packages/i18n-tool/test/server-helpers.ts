import type { I18nToolConfigInput, ResolvedI18nToolConfig } from '../config'
import { resolve } from 'node:path'
import { resolveI18nToolConfig } from '../config'

export function testConfig(
  root: string,
  overrides: Partial<I18nToolConfigInput> = {},
): ResolvedI18nToolConfig {
  return resolveI18nToolConfig({
    ai: {
      apiKeyEnv: 'TEST_I18N_AI_KEY',
      baseUrl: 'https://up.example/v1',
      model: 'test-model',
      provider: 'openai-compatible',
    },
    limits: { bodyBytes: 1_024 },
    resources: {
      adapter: 'vue-i18n-json',
      include: ['locales/**/*.json'],
      keyStyle: 'nested',
      layout: 'locale-per-file',
      localePattern: 'locales/{locale}.json',
      sourceLocale: 'en-US',
      targetLocales: ['zh-CN'],
    },
    root,
    server: { host: '127.0.0.1', open: false, port: 5_174 },
    ...overrides,
  }, {
    configPath: resolve(root, 'i18n-tool.config.ts'),
    cwd: root,
  })
}
