import { useData, useRoute } from 'vitepress'
import { computed } from 'vue'
import { ensureStartingSlash } from '../utils'

export interface SidebarItem {
  text?: string
  link?: string
  promotion?: string
  items?: SidebarItem[]
  children?: SidebarItem[]
}

export interface SidebarGroup {
  text: string
  children: Array<{ text: string, link: string, promotion?: string }>
}

function flattenLinks(items: SidebarItem[], result: SidebarGroup['children'] = []): SidebarGroup['children'] {
  for (const item of items) {
    if (item.link) {
      result.push({ text: item.text ?? item.link, link: item.link, promotion: item.promotion })
    }
    flattenLinks(item.items ?? item.children ?? [], result)
  }
  return result
}

function normalizeSidebar(items: SidebarItem[]): SidebarGroup[] {
  return items.flatMap((item) => {
    const nested = item.items ?? item.children
    if (nested) {
      return [{ text: item.text ?? '', children: flattenLinks(nested) }]
    }
    if (item.link) {
      return [{ text: '', children: flattenLinks([item]) }]
    }
    return []
  })
}

export function useSidebar() {
  const route = useRoute()
  const { page, theme } = useData()
  const sidebars = computed(() => {
    if (!page.value || page.value.frontmatter.sidebar === false)
      return []
    return getSidebarConfig(theme.value.sidebar, route.data.relativePath)
  })

  return {
    sidebars,
    hasSidebar: computed(() => sidebars.value.some(group => group.children.length > 0)),
  }
}

export function getSidebarConfig(sidebar: unknown, path: string): SidebarGroup[] {
  if (sidebar === false || sidebar === 'auto' || !sidebar)
    return []
  if (Array.isArray(sidebar))
    return normalizeSidebar(sidebar)

  const routePath = ensureStartingSlash(path)
  const entries = Object.entries(sidebar as Record<string, SidebarItem[]>)
    .sort(([left], [right]) => right.length - left.length)
  const match = entries.find(([directory]) => routePath.startsWith(ensureStartingSlash(directory)))
  return normalizeSidebar(match?.[1] ?? [])
}

export function getFlatSideBarLinks(sidebar: SidebarGroup[]) {
  return sidebar.flatMap(group => group.children)
}
