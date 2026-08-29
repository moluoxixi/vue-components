<script setup lang="ts">
import type { ConfigFormFlow } from '@moluoxixi/config-form-core'
import type { DesignerLocaleOptions, ModelOperation } from '@moluoxixi/config-form-designer'
import { X } from '@lucide/vue'
import { computed, defineAsyncComponent, useTemplateRef } from 'vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { useWorkbenchDialogFocus } from '../../components/use-dialog-focus'

type FlowOperation = Extract<ModelOperation, {
  type: 'addFlow'
    | 'updateFlowSettings'
    | 'updateFlowNode'
    | 'updateFlowEdges'
    | 'updateFlowGraph'
    | 'removeFlow'
}>

const props = defineProps<{
  fieldNames?: string[]
  flows: ConfigFormFlow[]
  locale?: DesignerLocaleOptions
  open: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  close: []
  operation: [operation: FlowOperation]
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
        <h2 id="flow-workspace-dialog-title">{{ locale.t('flow.dialog.title', 'Flow orchestration') }}</h2>
        <button type="button" :title="locale.t('flow.dialog.close', 'Close flow orchestration')" :aria-label="locale.t('flow.dialog.close', 'Close flow orchestration')" @click="emit('close')">
          <X :size="17" aria-hidden="true" />
        </button>
      </header>
      <div class="flow-workspace-dialog-body">
        <FlowWorkspace
          :flows="flows"
          :field-names="fieldNames"
          :locale="props.locale"
          :readonly="readonly"
          @operation="emit('operation', $event)"
        />
      </div>
    </section>
  </div>
</template>
