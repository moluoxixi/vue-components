<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { ProjectPageAction } from '../../project'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed } from 'vue'
import PageManager from '../../components/PageManager.vue'

const props = defineProps<{
  project?: ReadonlyProjectDocument
  projects: ProjectSummary[]
  busy?: boolean
  locale?: DesignerLocaleOptions
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  createPage: []
  openProject: [id: string]
  action: [action: ProjectPageAction]
}>()

const dialogTitle = computed(() => createDesignerLocale(props.locale).t('pageManager.title', 'Pages'))

</script>

<template>
  <ElDialog
    v-if="project"
    class="page-manager-dialog-shell"
    :model-value="open"
    :aria-label="dialogTitle"
    :show-close="false"
    width="min(980px, calc(100vw - 24px))"
    append-to="#workbench-overlays"
    transition="none"
    @close="emit('close')"
  >
    <PageManager
      :project="project"
      :projects="projects"
      :busy="busy"
      :locale="locale"
      @close="emit('close')"
      @create-page="emit('createPage')"
      @open-project="emit('openProject', $event)"
      @action="emit('action', $event)"
    />
  </ElDialog>
</template>
