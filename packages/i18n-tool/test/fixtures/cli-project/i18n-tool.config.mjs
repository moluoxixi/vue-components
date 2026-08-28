export default {
  ai: {
    apiKeyEnv: 'I18N_TOOL_FIXTURE_API_KEY',
    baseUrl: 'https://up.example/v1',
    model: 'fixture-model',
    provider: 'openai-compatible',
  },
  resources: {
    adapter: 'vue-i18n-json',
    include: ['locales/**/*.json'],
    keyStyle: 'nested',
    layout: 'locale-per-file',
    localePattern: 'locales/{locale}.json',
    sourceLocale: 'en-US',
    targetLocales: ['zh-CN'],
  },
  server: {
    host: '127.0.0.1',
    open: false,
    port: 5197,
  },
}
