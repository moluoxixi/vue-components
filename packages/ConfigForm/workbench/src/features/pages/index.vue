<script setup lang="ts">
import type { SurfaceManagerPageEmits, SurfaceManagerPageProps } from './types'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import { SurfaceManager } from './components'

const props = defineProps<SurfaceManagerPageProps>()

const emit = defineEmits<SurfaceManagerPageEmits>()

const screenTitle = computed(() => createDesignerLocale(props.locale).t('pageManager.title', 'Page management'))
</script>

<template>
  <main
    class="page-manager-page"
    :data-theme="props.theme"
    :data-palette="props.palette"
    :aria-label="screenTitle"
  >
    <SurfaceManager
      :busy="props.busy"
      :locale="props.locale"
      :project="props.project"
      @action="emit('action', $event)"
      @create-surface="emit('createSurface', $event)"
      @use-template="emit('useTemplate')"
      @save-template="emit('saveTemplate', $event)"
      @import-surface="emit('importSurface')"
      @export="emit('export', $event)"
      @export-source="emit('exportSource', $event)"
      @open-page="emit('openPage', $event)"
      @open-projects="emit('openProjects')"
    >
      <template v-if="$slots.header" #header="{ stats }">
        <slot name="header" :stats="stats" />
      </template>
    </SurfaceManager>
  </main>
</template>
