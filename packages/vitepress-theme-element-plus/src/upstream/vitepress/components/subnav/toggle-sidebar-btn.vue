<script lang="ts" setup>
import { PanelLeft } from '@lucide/vue'
import { useNavbarLocale } from '../../composables/navbar-locale'

const locale = useNavbarLocale()
</script>

<template>
  <button type="button" class="reset-btn sidebar-button" aria-controls="docs-sidebar">
    <PanelLeft :size="18" :stroke-width="1.75" aria-hidden="true" />
    <span>{{ locale.menu }}</span>
  </button>
</template>

<style scoped>
.sidebar-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  margin-left: -8px;
  border-radius: 5px;
  cursor: pointer;
  color: var(--ep-docs-text-color-light);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.sidebar-button:hover,
.sidebar-button[aria-expanded='true'] {
  color: var(--ep-docs-brand-color);
  background: var(--ep-docs-bg-color-mute);
}
</style>
