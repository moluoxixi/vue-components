<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { Component } from 'vue'
import type { WorkbenchManagementTarget } from '../../types'
import { Database, Files, FolderKanban, PanelsTopLeft } from '@lucide/vue'
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

const items = computed<Array<{ icon: Component; id: WorkbenchManagementTarget; label: string }>>(() => [
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

function selectTarget(index: string): void {
  if (index === 'projects' || index === 'pages') emit('select', index)
}
</script>

<template>
  <div class="management-shell" :data-palette="props.palette" :data-theme="props.theme">
    <nav class="management-shell__nav" :aria-label="locale.t('nav.management', 'Management')">
      <div class="management-shell__brand">
        <span class="management-shell__brand-mark"><PanelsTopLeft :size="21" aria-hidden="true" /></span>
        <span><strong>ConfigForm</strong><small>Studio</small></span>
      </div>
      <ElMenu
        class="management-shell__menu"
        :default-active="props.active ?? ''"
        :collapse-transition="false"
        mode="vertical"
        @select="selectTarget"
      >
        <ElMenuItem
          v-for="item in items"
          :key="item.id"
          class="management-shell__item"
          :index="item.id"
          :aria-current="item.id === props.active ? 'page' : undefined"
          :data-management-target="item.id"
        >
          <component :is="item.icon" :size="17" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </ElMenuItem>
      </ElMenu>
      <span class="management-shell__storage"
        ><Database :size="13" aria-hidden="true" />{{ locale.t('nav.localWorkspace', 'Local workspace') }}</span
      >
    </nav>
    <div class="management-shell__screen">
      <slot />
    </div>
  </div>
</template>
