<script lang="ts" setup>
import { useNavbarLocale } from '../../composables/navbar-locale'
import ToggleButton from '../icons/toggle-button.vue'

const locale = useNavbarLocale()
</script>

<template>
  <button class="reset-btn sidebar-button flex items-center">
    <ElIcon :size="20" class="mr-2">
      <ToggleButton />
    </ElIcon>
    <span class="leading-6">{{ locale.menu }}</span>
  </button>
</template>

<style>
.sidebar-button {
  cursor: pointer;
  color: var(--text-color);
}

.sidebar-button .icon {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
}

/* @media screen and (max-width: 1044px) {
  .sidebar-button {
    display: block;
  }
} */
</style>
