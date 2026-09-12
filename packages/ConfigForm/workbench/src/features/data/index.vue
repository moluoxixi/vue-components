<script setup lang="ts">
import type { DataDialogEmits, DataDialogProps, DataWorkspaceExpose } from './types'
import { X } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, ref, watch } from 'vue'
import { DataWorkspace } from './components'
import './style/index.css'

const props = defineProps<DataDialogProps>()
const emit = defineEmits<DataDialogEmits>()
const workspace = ref<DataWorkspaceExpose>()
const locale = computed(() => createDesignerLocale(props.locale))
const title = computed(() => locale.value.t('data.dialog.title', 'Variables and data sources'))
const closeLabel = computed(() => locale.value.t('data.dialog.close', 'Close page data'))
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
    class="data-workspace-dialog"
    data-data-workspace-dialog
    :model-value="open"
    :title="title"
    width="min(1180px, calc(100vw - 32px))"
    append-to="#workbench-overlays"
    transition="none"
    :show-close="false"
    :before-close="guardDialogClose"
    @close="emitCloseOnce"
  >
    <template #header>
      <div class="data-workspace-dialog__header">
        <h2>{{ title }}</h2>
        <ElButton native-type="button" text :title="closeLabel" :aria-label="closeLabel" @click="requestClose">
          <X :size="17" aria-hidden="true" />
        </ElButton>
      </div>
    </template>
    <DataWorkspace
      v-if="open"
      ref="workspace"
      :active="open"
      :execute="execute"
      :locale="props.locale"
      :on-request="onRequest"
      :page-id="pageId"
      :readonly="readonly"
      :reference-fields="referenceFields"
      :runtime="runtime"
      :runtime-revision="runtimeRevision"
      :test-context="testContext"
      @close="emitCloseOnce"
    />
  </ElDialog>
</template>
