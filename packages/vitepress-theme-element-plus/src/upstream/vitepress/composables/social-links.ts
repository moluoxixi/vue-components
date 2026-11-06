import type { DefaultTheme } from 'vitepress'
import { Cloud, CodeXml, GitBranch, HardDrive } from '@lucide/vue'
import { useData } from 'vitepress'
import { computed } from 'vue'
import GitHubIcon from '../components/icons/github.vue'

type SocialLinksTheme = Pick<DefaultTheme.Config, 'socialLinks'>

const repositoryIcons = {
  gitee: CodeXml,
  github: GitHubIcon,
  gitlab: GitBranch,
  local: HardDrive,
  yunxiao: Cloud,
} as const

export function resolveSocialLinks(theme: SocialLinksTheme) {
  const configured = Array.isArray(theme.socialLinks) ? theme.socialLinks : []
  if (configured.length) {
    return configured.map(link => ({
      link: link.link,
      icon: typeof link.icon === 'string'
        ? repositoryIcons[link.icon.toLowerCase() as keyof typeof repositoryIcons]
        : undefined,
      text: typeof link.ariaLabel === 'string'
        ? link.ariaLabel
        : typeof link.icon === 'string'
          ? link.icon.replace(/^./, value => value.toUpperCase())
          : 'Social link',
    }))
  }
  return []
}

export function useSocialLinks() {
  const { theme } = useData()
  return computed(() => resolveSocialLinks(theme.value))
}
