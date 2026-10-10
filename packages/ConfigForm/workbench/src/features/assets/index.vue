<script setup lang="ts">
import type { AssetManagerDialogProps } from './types/props'
import { Database } from '@lucide/vue'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, useTemplateRef } from 'vue'
import AssetManagerWorkspace from './components/AssetManagerWorkspace.vue'

const props = defineProps<AssetManagerDialogProps>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const locale = computed(() => createDesignerLocale(props.locale))
const workspace = useTemplateRef<InstanceType<typeof AssetManagerWorkspace>>('workspace')
defineExpose({
  busy: computed(() => workspace.value?.busy ?? false),
  hasChanges: computed(() => workspace.value?.hasChanges ?? false),
})
</script>

<template>
  <ElDialog
    class="asset-manager-dialog"
    :model-value="modelValue"
    :width="workspace?.hasDataset ? 'min(1280px, calc(100vw - 32px))' : 'min(1040px, calc(100vw - 32px))'"
    :title="locale.t('assets.title', 'Assets')"
    append-to="#workbench-overlays"
    align-center
    transition="none"
    data-asset-manager
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header="{ titleId }">
      <div class="asset-manager__dialog-title flex min-w-0 items-center gap-2">
        <Database :size="18" aria-hidden="true" />
        <h2 :id="titleId">
          {{ locale.t('assets.title', 'Assets') }}
        </h2>
      </div>
    </template>
    <AssetManagerWorkspace
      ref="workspace"
      :active="modelValue"
      :commands="commands"
      :initial-id="initialId"
      :initial-kind="initialKind"
      :locale="props.locale"
      :project="project"
    />
  </ElDialog>
</template>

<style src="./style/index.css" scoped />
