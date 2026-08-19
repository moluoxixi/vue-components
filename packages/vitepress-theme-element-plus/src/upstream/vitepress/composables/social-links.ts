import type { DefaultTheme } from 'vitepress'
import { useData } from 'vitepress'
import { computed } from 'vue'

type SocialLinksTheme = Pick<DefaultTheme.Config, 'socialLinks'> & { repository?: unknown }

export function resolveSocialLinks(theme: SocialLinksTheme) {
  const configured = Array.isArray(theme.socialLinks) ? theme.socialLinks : []
  if (configured.length) {
    return configured.map(link => ({
      link: link.link,
      icon: undefined,
      text: typeof link.ariaLabel === 'string'
        ? link.ariaLabel
        : typeof link.icon === 'string'
          ? link.icon.replace(/^./, value => value.toUpperCase())
          : 'Social link',
    }))
  }
  return theme.repository
    ? [{ link: String(theme.repository), icon: undefined, text: 'GitHub' }]
    : []
}

export function useSocialLinks() {
  const { theme } = useData()
  return computed(() => resolveSocialLinks(theme.value))
}
