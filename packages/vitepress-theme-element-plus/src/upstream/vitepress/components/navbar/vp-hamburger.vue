<script setup lang="ts">
import { Menu, X } from '@lucide/vue'
import { useNavbarLocale } from '../../composables/navbar-locale'

const props = defineProps<{
  active: boolean
}>()

const locale = useNavbarLocale()
</script>

<template>
  <button
    type="button"
    :class="{ active: props.active }"
    :aria-label="locale['mobile-nav']"
    :aria-expanded="props.active"
    aria-controls="full-screen"
    class="reset-btn menu-hamburger"
  >
    <X v-if="props.active" :size="20" :stroke-width="1.75" aria-hidden="true" />
    <Menu v-else :size="20" :stroke-width="1.75" aria-hidden="true" />
  </button>
</template>

<style scoped lang="scss">
@use '../../styles/mixins' as *;

.menu-hamburger {
  width: 36px;
  height: 36px;
  display: inline-flex;
  flex: none;
  align-items: center;
  cursor: pointer;
  justify-content: center;
  padding: 0;
  border-radius: 6px;
  color: var(--ep-docs-text-color-light);

  &:hover,
  &.active {
    color: var(--ep-docs-brand-color);
    background: var(--ep-docs-bg-color-mute);
  }

  @include respond-to('lg') {
    display: none;
  }
}
</style>
