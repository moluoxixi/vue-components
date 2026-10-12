<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { LayoutGrid, List } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'

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
    <button v-for="view in views" :key="view.id" type="button" :aria-label="view.label" :title="view.label" :aria-pressed="model === view.id" @click="model = view.id">
      <component :is="view.icon" :size="16" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.browse-view-toggle { display: inline-flex; flex: none; gap: 2px; padding: 2px; border: 1px solid var(--wb-separator); border-radius: 6px; }
.browse-view-toggle button { display: grid; width: 28px; height: 28px; padding: 0; place-items: center; color: var(--wb-muted); border: 0; border-radius: 4px; background: transparent; cursor: pointer; }
.browse-view-toggle button:hover { background: var(--wb-hover); }
.browse-view-toggle button[aria-pressed='true'] { color: var(--wb-text-strong); background: var(--wb-hover); }
.browse-view-toggle button:focus-visible { outline: 2px solid var(--wb-focus); outline-offset: 1px; }
@media (pointer: coarse) { .browse-view-toggle button { width: 40px; height: 40px; } }
</style>
