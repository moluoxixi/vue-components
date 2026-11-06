<script setup lang="ts">
import { ArrowUp } from '@lucide/vue'
import { useSidebar } from '../composables/sidebar'
import { useBackTop } from '../composables/back-top'
import { useNavbarLocale } from '../composables/navbar-locale'
import ToggleSidebarBtn from './subnav/toggle-sidebar-btn.vue'

defineProps<{
  isSidebarOpen: boolean
}>()
defineEmits(['open-menu'])

const { hasSidebar } = useSidebar()
const { shouldShow, scrollToTop } = useBackTop()
const locale = useNavbarLocale()
</script>

<template>
  <div class="sub-nav" data-docs-ui >
    <ToggleSidebarBtn
      v-if="hasSidebar"
      :aria-expanded="isSidebarOpen"
      @click="$emit('open-menu')"
    />
    <button
      v-if="shouldShow"
      type="button"
      class="go-back-top"
      @click.prevent.stop="scrollToTop"
    >
      <ArrowUp :size="14" aria-hidden="true" />
      {{ locale['back-top'] }}
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/mixins' as *;


.sub-nav {
  @include with-border;
  @include with-bg;
  position: sticky;
  top: var(--ep-docs-header-height);
  left: 0;
  width: 100%;
  display: flex;
  min-height: var(--ep-docs-sub-nav-height);
  align-items: center;
  padding: 0 24px;
  justify-content: space-between;
  z-index: var(--ep-docs-sub-nav-z-index);
  overflow: hidden;

  @media (max-width: 767px) {
    padding: 0 16px;
  }

  .go-back-top {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    gap: 5px;
    padding: 0 6px;
    border-radius: 5px;
    color: var(--ep-docs-text-color-light);
    font-size: 12px;

    &:hover { color: var(--ep-docs-brand-color); }
  }

  @include respond-to('lg') {
    display: none !important;
  }
}

</style>
