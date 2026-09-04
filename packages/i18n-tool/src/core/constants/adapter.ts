import type { LocaleAdapterId } from '../types'

export const LOCALE_ADAPTER_IDS = [
  'generic-json',
  'i18next-json',
  'vue-i18n-json',
] as const satisfies readonly LocaleAdapterId[]
