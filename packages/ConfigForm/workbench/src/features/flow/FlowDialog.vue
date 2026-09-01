<script setup lang="ts">
import type { ConfigFormFlow, ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import { X } from '@lucide/vue'
import { computed, defineAsyncComponent } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import type { FlowEventTarget } from '../../flow/event-targets'

const props = defineProps<{
  fieldNames?: string[]
  eventTargets?: FlowEventTarget[]
  flows: ConfigFormFlow[]
  initialTrigger?: ConfigFormFlowTrigger
  locale?: DesignerLocaleOptions
  open: boolean
  pageId: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  command: [command: ProjectCommand]
}>()

const FlowWorkspace = defineAsyncComponent(() => import('../../components/FlowWorkspace.vue'))
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
        :field-names="fieldNames"
        :event-targets="eventTargets"
        :locale="props.locale"
        :page-id="pageId"
        :readonly="readonly"
        @command="emit('command', $event)"
      />
    </div>
  </ElDialog>
</template>
