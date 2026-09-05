<script setup lang="ts">
import type { FlowDialogEmits, FlowDialogProps } from './types'
import { X } from '@lucide/vue'
import { computed, defineAsyncComponent } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'

const props = defineProps<FlowDialogProps>()

const emit = defineEmits<FlowDialogEmits>()

const FlowWorkspace = defineAsyncComponent(() => import('./components/FlowWorkspace').then(module => module.FlowWorkspace))
const locale = computed(() => createDesignerLocale(props.locale))
const dialogTitle = computed(() => locale.value.t('flow.dialog.title', 'Event flow orchestration'))
const closeLabel = computed(() => locale.value.t('flow.dialog.close', 'Close event flow orchestration'))
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
    @close="emit('close')"
  >
    <template #header>
      <div class="flow-workspace-dialog-header">
        <h2>{{ dialogTitle }}</h2>
        <ElButton
          native-type="button"
          text
          :title="closeLabel"
          :aria-label="closeLabel"
          @click="emit('close')"
        >
          <X :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </template>
    <div class="flow-workspace-dialog-body">
      <FlowWorkspace
        :flows="flows"
        :initial-trigger="initialTrigger"
        :event-targets="eventTargets"
        :locale="props.locale"
        :page-id="pageId"
        :readonly="readonly"
        @close="emit('close')"
        @command="emit('command', $event)"
      />
    </div>
  </ElDialog>
</template>
