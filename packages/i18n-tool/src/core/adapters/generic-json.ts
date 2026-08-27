import { createJsonLocaleAdapter } from './json-adapter'

export const genericJsonAdapter = createJsonLocaleAdapter(
  'generic-json',
  ['locale-first', 'locale-per-file'],
)
