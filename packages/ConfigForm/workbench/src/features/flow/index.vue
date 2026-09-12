<script setup lang="ts">
import type { FlowDialogEmits, FlowDialogProps } from './types'
import type { FlowWorkspaceExpose } from './components/FlowWorkspace'
import { X } from '@lucide/vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'

const props = defineProps<FlowDialogProps>()
const emit = defineEmits<FlowDialogEmits>()
const FlowWorkspace = defineAsyncComponent(() => import('./components/FlowWorkspace').then(module => module.FlowWorkspace))
const workspace = ref<FlowWorkspaceExpose>()
const locale = computed(() => createDesignerLocale(props.locale))
const dialogTitle = computed(() => locale.value.t('flow.dialog.title', 'Event flow'))
const closeLabel = computed(() => locale.value.t('flow.dialog.close', 'Close event flow'))
let closeEmitted = false

watch(() => props.open, (open) => {
  if (open)
    closeEmitted = false
})

function emitCloseOnce(): void {
  if (closeEmitted)
    return
  closeEmitted = true
  emit('close')
}

async function requestClose(): Promise<void> {
  if (!workspace.value || await workspace.value.confirmClose())
    emitCloseOnce()
}

async function guardDialogClose(done: () => void): Promise<void> {
  if (!workspace.value || await workspace.value.confirmClose()) {
    emitCloseOnce()
    done()
  }
}
</script>

<template>
  <ElDialog
    class="flow-workspace-dialog"
    data-flow-workspace-dialog
    :model-value="open"
    :title="dialogTitle"
    width="min(1320px, calc(100vw - 32px))"
    append-to="#workbench-overlays"
    transition="none"
    :show-close="false"
    :before-close="guardDialogClose"
    @close="emitCloseOnce"
  >
    <template #header>
      <div class="flow-workspace-dialog-header">
        <h2>{{ dialogTitle }}</h2>
        <ElButton
          native-type="button"
          text
          :title="closeLabel"
          :aria-label="closeLabel"
          @click="requestClose"
        >
          <X :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </template>
    <div class="flow-workspace-dialog-body">
      <FlowWorkspace
        ref="workspace"
        :action-descriptors="actionDescriptors"
        :event-targets="eventTargets"
        :execute="execute"
        :flows="flows"
        :initial-trigger="initialTrigger"
        :locale="props.locale"
        :page-id="pageId"
        :readonly="readonly"
        :reference-fields="referenceFields"
        :source-catalog="sourceCatalog"
        @close="emitCloseOnce"
      />
    </div>
  </ElDialog>
</template>
