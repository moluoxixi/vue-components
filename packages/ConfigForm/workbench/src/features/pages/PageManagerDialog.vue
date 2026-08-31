<script setup lang="ts">
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectSummary, ReadonlyProjectDocument } from '@moluoxixi/config-form-model'
import type { ProjectPageAction } from '../../project'
import { useTemplateRef } from 'vue'
import PageManager from '../../components/PageManager.vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'

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

const dialog = useTemplateRef<HTMLElement>('dialog')
const { handleKeydown } = useWorkbenchDialogFocus(
  () => props.open,
  dialog,
  () => emit('close'),
)
</script>

<template>
  <div
    v-if="open && project"
    ref="dialog"
    class="page-manager-overlay"
    @click.self="emit('close')"
    @keydown="handleKeydown"
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
  </div>
</template>
