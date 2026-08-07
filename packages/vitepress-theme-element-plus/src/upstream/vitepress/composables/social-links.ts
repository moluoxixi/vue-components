import { useData } from 'vitepress'
import { computed } from 'vue'

export function useSocialLinks() {
  const { theme } = useData()
  return computed(() => {
    const configured = Array.isArray(theme.value.socialLinks) ? theme.value.socialLinks : []
    if (configured.length) {
      return configured.map(link => ({
        link: link.link,
        icon: undefined,
        text: typeof link.icon === 'string' ? link.icon.replace(/^./, value => value.toUpperCase()) : 'Social link',
      }))
    }
    return theme.value.repository
      ? [{ link: String(theme.value.repository), icon: undefined, text: 'GitHub' }]
      : []
  })
}
