<script setup lang="ts">
import { isClient, useEventListener, useToggle } from '@vueuse/core'
import { useSidebar } from '../composables/sidebar'
import { useToggleWidgets } from '../composables/toggle-widgets'
import { breakpoints } from '../constant'
import VPOverlay from './vp-overlay.vue'
import VPSkipLink from './vp-skip-link.vue'
import VPNav from './vp-nav.vue'
import VPSubNav from './vp-subnav.vue'
import VPSidebar from './vp-sidebar.vue'
import VPContent from './vp-content.vue'

const [isSidebarOpen, toggleSidebar] = useToggle(false)
const { hasSidebar } = useSidebar()

useToggleWidgets(isSidebarOpen, () => {
  if (!isClient) return
  if (window.outerWidth >= breakpoints.lg) {
    toggleSidebar(false)
  }
})

useEventListener('keydown', (e) => {
  if (!isClient) return
  if (e.code === 'Escape' && isSidebarOpen.value) {
    toggleSidebar(false)
    document.querySelector<HTMLButtonElement>('.sidebar-button')?.focus()
  }
})

</script>

<template>
  <div class="App">
    <VPSkipLink />
    <VPOverlay
      class="overlay"
      :show="isSidebarOpen"
      @click="toggleSidebar(false)"
    />
    <VPNav />
    <VPSubNav
      v-if="hasSidebar"
      :is-sidebar-open="isSidebarOpen"
      @open-menu="toggleSidebar(true)"
    />
    <VPSidebar :open="isSidebarOpen" @close="toggleSidebar(false)">
      <template #bottom>
        <slot name="sidebar-bottom" />
      </template>
    </VPSidebar>
    <VPContent>
      <template #content-top>
        <slot name="content-top" />
      </template>
      <template #content-bottom>
        <slot name="content-bottom" />
      </template>
      <template #aside-top>
        <slot name="aside-top" />
      </template>
      <template #aside-mid>
        <slot name="aside-mid" />
      </template>
      <template #aside-bottom>
        <slot name="aside-bottom" />
      </template>
    </VPContent>
  </div>
</template>
