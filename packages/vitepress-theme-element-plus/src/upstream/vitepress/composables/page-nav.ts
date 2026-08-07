import { useData } from 'vitepress'
import { computed } from 'vue'
import { isActive } from '../utils'
import { getFlatSideBarLinks, getSidebarConfig } from './sidebar'

export function usePageNav() {
  const { page, theme } = useData()

  const candidates = computed(() => {
    const config = getSidebarConfig(
      theme.value.sidebar,
      page.value.relativePath,
    )
    return getFlatSideBarLinks(config)
  })

  const index = computed(() => {
    return candidates.value.findIndex((item) => {
      return isActive(page.value.relativePath, item.link)
    })
  })
  const next = computed(() => {
    if (
      theme.value.nextLinks !== false
      && index.value > -1
      && index.value < candidates.value.length - 1
    ) {
      return candidates.value[index.value + 1]
    }

    return null
  })

  const prev = computed(() => {
    if (theme.value.prevLinks !== false && index.value > 0) {
      return candidates.value[index.value - 1]
    }
    return null
  })

  const hasLinks = computed(() => !!next.value || !!prev.value)
  return {
    next,
    prev,
    hasLinks,
  }
}
