<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { Component } from 'vue'
import type { WorkbenchManagementTarget } from '../types'
import { Files, FolderKanban } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'

const props = defineProps<{
  active?: WorkbenchManagementTarget
  locale?: DesignerLocaleOptions
  palette: string
  theme: string
}>()

const emit = defineEmits<{
  select: [target: WorkbenchManagementTarget]
}>()

const locale = computed(() => createDesignerLocale(props.locale))

/**
 * The two management consoles of the application. They are siblings: project
 * management owns the project list, page management owns the pages of the open
 * project. Both screens render this rail, so either console is always one click
 * away — and the rail is the discoverable entry that the topbar icon and the
 * left-panel button never were.
 */
const items = computed<Array<{ icon: Component, id: WorkbenchManagementTarget, label: string }>>(() => [
  {
    icon: FolderKanban,
    id: 'projects',
    label: locale.value.t('projects.title', 'Projects'),
  },
  {
    icon: Files,
    id: 'pages',
    label: locale.value.t('pageManager.title', 'Page management'),
  },
])
</script>

<template>
  <div
    class="management-shell"
    :data-palette="props.palette"
    :data-theme="props.theme"
  >
    <nav class="management-shell__nav" :aria-label="locale.t('nav.management', 'Management')">
      <ElButton
        v-for="item in items"
        :key="item.id"
        class="management-shell__tab"
        :class="{ 'is-active': item.id === props.active }"
        :aria-current="item.id === props.active ? 'page' : undefined"
        :data-management-target="item.id"
        @click="emit('select', item.id)"
      >
        <component :is="item.icon" :size="17" aria-hidden="true" />
        <span class="management-shell__label">{{ item.label }}</span>
      </ElButton>
    </nav>
    <div class="management-shell__screen">
      <slot />
    </div>
  </div>
</template>
