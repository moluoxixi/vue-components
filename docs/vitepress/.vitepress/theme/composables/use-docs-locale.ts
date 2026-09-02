import { useData, withBase } from 'vitepress'
import { computed } from 'vue'
import {
  getDocsMessages,
  localePath,
  resolveDocsLocale,
} from '../../catalog/i18n'

export function useDocsLocale() {
  const { lang, localeIndex } = useData()
  const locale = computed(() => resolveDocsLocale(lang.value, localeIndex.value))
  const messages = computed(() => getDocsMessages(locale.value))
  const asset = (path: string) => withBase(path)
  const link = (path: string) => withBase(localePath(locale.value, path))

  return { asset, locale, messages, link }
}
