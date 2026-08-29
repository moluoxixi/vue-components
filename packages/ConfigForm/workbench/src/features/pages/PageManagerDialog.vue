<script setup lang="ts">
import type {
  WorkspaceApplication,
  WorkspaceApplicationOperation,
  WorkspaceApplicationSummary,
} from '../../project'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import { useTemplateRef } from 'vue'
import PageManager from '../../components/PageManager.vue'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'

const props = defineProps<{
  application?: WorkspaceApplication
  applications: WorkspaceApplicationSummary[]
  busy?: boolean
  locale?: DesignerLocaleOptions
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  createPage: []
  openApplication: [id: string]
  operation: [operation: WorkspaceApplicationOperation]
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
    v-if="open && application"
    ref="dialog"
    class="page-manager-overlay"
    @click.self="emit('close')"
    @keydown="handleKeydown"
  >
    <PageManager
      :application="application"
      :applications="applications"
      :busy="busy"
      :locale="locale"
      @close="emit('close')"
      @create-page="emit('createPage')"
      @open-application="emit('openApplication', $event)"
      @operation="emit('operation', $event)"
    />
  </div>
</template>
