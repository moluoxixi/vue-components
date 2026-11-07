<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { LayoutGrid, List } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import WorkbenchCommandHint from './WorkbenchCommandHint/index.vue'

const props = defineProps<{ locale?: DesignerLocaleOptions }>()
const model = defineModel<'cards' | 'list'>({ required: true })
const locale = computed(() => createDesignerLocale(props.locale))
const views = computed(() => [
  { id: 'list' as const, icon: List, label: locale.value.t('browse.list', 'List view') },
  { id: 'cards' as const, icon: LayoutGrid, label: locale.value.t('browse.cards', 'Card view') },
])
</script>

<template>
  <div class="browse-view-toggle" role="group" :aria-label="locale.t('browse.view', 'Display options')">
    <WorkbenchCommandHint v-for="view in views" :key="view.id" :label="view.label">
      <button type="button" :aria-label="view.label" :aria-pressed="model === view.id" @click="model = view.id">
        <component :is="view.icon" :size="16" aria-hidden="true" />
      </button>
    </WorkbenchCommandHint>
  </div>
</template>

<style scoped>
@reference "../styles/tailwind.css";

.browse-view-toggle {
  display: inline-flex;
  flex: none;
  @apply gap-1 p-1;
  border: 1px solid var(--wb-separator);
  border-radius: 6px;
}
.browse-view-toggle button {
  display: grid;
  width: 28px;
  height: 28px;
  @apply p-0;
  place-items: center;
  color: var(--wb-muted);
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}
.browse-view-toggle button:hover {
  background: var(--wb-hover);
}
.browse-view-toggle button[aria-pressed='true'] {
  color: var(--wb-text-strong);
  background: var(--wb-hover);
}
.browse-view-toggle button:focus-visible {
  outline: 2px solid var(--wb-focus);
  outline-offset: 1px;
}
@media (pointer: coarse) {
  .browse-view-toggle button {
    width: 40px;
    height: 40px;
  }
}
</style>
