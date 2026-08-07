import type { ElementPlusDocsRuntimeLocale } from '../../../types'
import { useData } from 'vitepress'
import { computed } from 'vue'
import { defaultLang } from '../constant'

export function resolveLang(
  lang: string | undefined,
  localeIndex: string | undefined,
  locales: Record<string, ElementPlusDocsRuntimeLocale> | undefined,
  fallback: string | undefined,
): string {
  const normalizedLang = lang?.trim().toLowerCase()
  const localeValues = Object.values(locales ?? {})
  const languageLocale = localeValues.find(locale =>
    locale.lang.toLowerCase() === normalizedLang || locale.siteKey.toLowerCase() === normalizedLang,
  )
  if (languageLocale)
    return languageLocale.lang

  const siteLocale = localeValues.find(locale => locale.siteKey.toLowerCase() === (localeIndex ?? '').toLowerCase())
  if (siteLocale)
    return siteLocale.lang

  return lang?.trim() || fallback || defaultLang
}

export function useLang() {
  const { lang, localeIndex, theme } = useData()
  return computed(() => resolveLang(lang.value, localeIndex.value, theme.value?.locales, theme.value?.defaultLocale))
}
