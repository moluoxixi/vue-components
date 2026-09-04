import type { TemplateWorkspaceViewport } from '../types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export function useTemplateViewport() {
  const viewport = ref<TemplateWorkspaceViewport>('desktop')
  const subscriptions: Array<() => void> = []

  onMounted(() => {
    if (typeof window.matchMedia !== 'function')
      return

    const mobile = window.matchMedia('(max-width: 640px)')
    const medium = window.matchMedia('(min-width: 641px) and (max-width: 1000px)')
    const sync = () => {
      viewport.value = mobile.matches ? 'mobile' : medium.matches ? 'medium' : 'desktop'
    }

    for (const query of [mobile, medium]) {
      query.addEventListener?.('change', sync)
      subscriptions.push(() => query.removeEventListener?.('change', sync))
    }
    sync()
  })

  onBeforeUnmount(() => {
    subscriptions.splice(0).forEach(dispose => dispose())
  })

  return {
    isDesktop: computed(() => viewport.value === 'desktop'),
    isMedium: computed(() => viewport.value === 'medium'),
    isMobile: computed(() => viewport.value === 'mobile'),
    viewport,
  }
}
