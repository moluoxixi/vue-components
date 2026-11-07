<script lang="ts" setup>
import { provideDocsUi } from '../../../runtime/provide-docs-ui'
import { useSidebar } from '../composables/sidebar'
import VPSidebarLink from './sidebar/vp-sidebar-link.vue'

const props = defineProps<{ open: boolean }>()
defineEmits(['close'])

// const isHome = useIsHome()
const { sidebars, hasSidebar } = useSidebar()
provideDocsUi()
</script>

<template>
  <el-scrollbar v-if="hasSidebar" id="docs-sidebar" data-docs-ui class="sidebar" :class="{ open: props.open }">
    <aside>
      <slot name="top" />
      <div class="sidebar-groups">
        <section
          v-for="(item, key) of sidebars"
          :key="key"
          class="sidebar-group"
        >
          <p class="sidebar-group__title">
            {{ item.text }}
          </p>
          <VPSidebarLink
            v-for="(child, childKey) in item.children"
            :key="childKey"
            :item="child"
            @close="$emit('close')"
          />
        </section>
      </div>
      <slot name="bottom" />
    </aside>
  </el-scrollbar>
</template>

<style scoped lang="scss">
@use '../styles/mixins' as *;
// @use './sidebar-link.scss';

.sidebar.epd-scrollbar {
  position: fixed;
  top: var(--ep-docs-header-height);
  bottom: 0;
  left: 0;
  width: var(--ep-docs-sidebar-width-xs);
  background-color: var(--ep-docs-bg-color);
  padding: 24px;
  overflow-y: auto;
  transform: translate(-100%);
  transition:
    background-color var(--epd-transition-duration-fast),
    opacity 0.25s,
    transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);

  &.open {
    transform: translate(0);
  }

  .sidebar-groups {
    padding: 0 2px;

    @include respond-to('lg') {
      padding-bottom: 48px;
    }

    .sidebar-group__title {
      color: var(--ep-docs-text-color);
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      line-height: 24px;
    }

    .sidebar-group + .sidebar-group {
      padding-top: 20px;
    }
  }

  @media (max-width: 767px) {
    width: calc(var(--ep-docs-vp-sidebar-width-mobile) - 14px);
    z-index: var(--ep-docs-sidebar-z-index-mobile);
  }

  @include respond-to('md') {
    width: calc(var(--ep-docs-vp-sidebar-width-small));
    z-index: var(--ep-docs-sidebar-z-index-mobile);
  }

  @include respond-to('lg') {
    z-index: var(--ep-docs-sidebar-z-index);
    top: var(--ep-docs-header-height);
    transform: translate(0);
  }

  @include respond-to('xxl') {
    padding: 48px 32px;
    width: calc(var(--ep-docs-vp-sidebar-width-small) + 32px);
  }

  @include respond-to('max') {
    padding: 48px;
    width: calc(var(--ep-docs-vp-sidebar-width-small) + 48px);
  }
}
</style>
