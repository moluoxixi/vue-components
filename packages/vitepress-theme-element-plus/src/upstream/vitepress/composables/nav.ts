import { useData } from 'vitepress'
import { computed } from 'vue'

export function useNav() {
  const { theme } = useData()
  return computed(() => Array.isArray(theme.value.nav) ? theme.value.nav : [])
}
