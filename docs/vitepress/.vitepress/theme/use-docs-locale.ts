import { useData, withBase } from 'vitepress'
import { computed } from 'vue'
import {
  getDocsMessages,
  localePath,
  resolveDocsLocale,
} from '../docs-i18n'

export function useDocsLocale() {
  const { lang } = useData()
  const locale = computed(() => resolveDocsLocale(lang.value))
  const messages = computed(() => getDocsMessages(locale.value))
  const link = (path: string) => withBase(localePath(locale.value, path))

  return { locale, messages, link }
}
