import { useStorage } from '@vueuse/core'
import { useRoute, withBase } from 'vitepress'
import { computed } from 'vue'
import navbarLocale from '../../../i18n/component/navbar.json'
import translationLocale from '../../../i18n/component/translation.json'
import { PREFERRED_LANG_KEY } from '../constant'
import { switchLocalePath, useSiteLocales } from './site-locale'

export function useTranslation() {
  const route = useRoute()
  const { lang, locales } = useSiteLocales()
  const language = useStorage(PREFERRED_LANG_KEY, lang.value)
  const languageMap = computed(() => Object.fromEntries(
    Object.entries(locales.value).map(([key, value]) => [key, value.label]),
  ))
  const langs = computed(() => Object.keys(locales.value).filter(locale => locale !== lang.value))
  const locale = computed(() => {
    const fallback = 'en-US'
    const translation = translationLocale[lang.value] ?? translationLocale[fallback]
    const navbar = navbarLocale[lang.value] ?? navbarLocale[fallback]
    return {
      language: navbar.language,
      selectLanguage: translation['select-language'],
    }
  })

  const getTargetUrl = (targetLang: string) => switchLocalePath(
    route.path,
    lang.value,
    targetLang,
    locales.value,
  )

  const switchLang = (targetLang: string) => {
    if (lang.value === targetLang)
      return
    language.value = targetLang
    window.location.href = withBase(getTargetUrl(targetLang))
  }

  return {
    locale,
    languageMap,
    langs,
    lang,
    getTargetUrl,
    switchLang,
  }
}
