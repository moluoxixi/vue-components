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
      :projects="props.projects"
      @action="emit('action', $event)"
      @close="emit('close')"
      @create-surface="emit('createSurface')"
      @open-page="emit('openPage', $event)"
      @open-project="emit('openProject', $event)"
      @open-projects="emit('openProjects')"
    />
  </main>
</template>
