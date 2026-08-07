import { useData } from 'vitepress'
import { computed } from 'vue'
import { defaultLang } from '../constant'

export function useLang() {
  const { lang, theme } = useData()
  return computed(() => lang.value || theme.value?.defaultLocale || defaultLang)
}
