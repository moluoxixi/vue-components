import { createJsonLocaleAdapter } from './json-adapter'

export const vueI18nJsonAdapter = createJsonLocaleAdapter(
  'vue-i18n-json',
  ['locale-per-file'],
)
