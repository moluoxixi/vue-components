import type { ElementPlusDocsRuntimeLocale } from '../../../types'
import { useData } from 'vitepress'
import { computed } from 'vue'
import { useLang } from './lang'

export type RuntimeLocaleMap = Record<string, ElementPlusDocsRuntimeLocale>

export function localeHomePath(lang: string, locales: RuntimeLocaleMap): string {
  const prefix = locales[lang]?.pathPrefix ?? ''
  return prefix ? `${prefix}/` : '/'
}

export function switchLocalePath(
  currentPath: string,
  currentLang: string,
  targetLang: string,
  locales: RuntimeLocaleMap,
): string {
  const path = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
  const currentPrefix = locales[currentLang]?.pathPrefix ?? ''
  const targetPrefix = locales[targetLang]?.pathPrefix ?? ''
  const suffix = currentPrefix && (path === currentPrefix || path.startsWith(`${currentPrefix}/`))
    ? path.slice(currentPrefix.length) || '/'
    : path
  return `${targetPrefix}${suffix}` || '/'
}

export function useSiteLocales() {
  const { theme } = useData()
  const lang = useLang()
  const locales = computed<RuntimeLocaleMap>(() => theme.value?.locales ?? {})
  const homePath = computed(() => localeHomePath(lang.value, locales.value))

  return { homePath, lang, locales }
}
