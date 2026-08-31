<script setup lang="ts">
import type { ConfigFormFlow, ConfigFormFlowTrigger } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions } from '@moluoxixi/config-form-designer'
import type { ProjectCommand } from '@moluoxixi/config-form-model'
import { X } from '@lucide/vue'
import { computed, defineAsyncComponent, useTemplateRef } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'
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
const dialog = useTemplateRef<HTMLElement>('dialog')
const locale = computed(() => createDesignerLocale(props.locale))
const { handleKeydown } = useWorkbenchDialogFocus(
  () => props.open,
  dialog,
  () => emit('close'),
)
</script>

<template>
  <div v-if="open" class="flow-workspace-overlay" @click.self="emit('close')">
    <section
      ref="dialog"
      class="flow-workspace-dialog"
      data-flow-workspace-dialog
      role="dialog"
      aria-modal="true"
      aria-labelledby="flow-workspace-dialog-title"
      tabindex="-1"
      @keydown="handleKeydown"
    >
      <header class="flow-workspace-dialog-header">
        <h2 id="flow-workspace-dialog-title">{{ locale.t('flow.dialog.title', 'Event flow orchestration') }}</h2>
        <button type="button" :title="locale.t('flow.dialog.close', 'Close event flow orchestration')" :aria-label="locale.t('flow.dialog.close', 'Close event flow orchestration')" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
        </button>
      </header>
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
    </section>
  </div>
</template>
