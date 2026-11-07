<script setup lang="ts">
import { isClient, useEventListener } from '@vueuse/core'
import { useFullScreen } from '../composables/fullscreen'
import { useSidebar } from '../composables/sidebar'
import { useToggleWidgets } from '../composables/toggle-widgets'
import { breakpoints } from '../constant'
import VpNavFull from './vp-nav-full.vue'
import VpNavbar from './vp-navbar.vue'

const { hasSidebar } = useSidebar()
const { toggleFullScreen, isFullScreen } = useFullScreen()
const close = () => toggleFullScreen(false)

useToggleWidgets(isFullScreen, () => {
  if (!isClient)
    return
  if (window.innerWidth >= breakpoints.lg) {
    close()
  }
})

useEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isFullScreen.value) {
    close()
    document.querySelector<HTMLButtonElement>('.menu-hamburger')?.focus()
  }
})
</script>

<template>
  <header data-docs-ui class="navbar" :class="{ 'has-sidebar': hasSidebar }">
    <VpNavbar :full-screen="isFullScreen" @toggle="toggleFullScreen" />
    <VpNavFull :full-screen="isFullScreen" class="full-screen" @close="close" />
  </header>
</template>

<style scoped lang="scss">
.navbar {
  top: 0;
  left: 0;
  position: sticky;
  width: 100%;
  z-index: var(--ep-docs-nav-z-index);

}
</style>
