<script setup lang="ts">
import type { PageManagerDialogEmits, PageManagerDialogProps } from './types'
import { createDesignerLocale } from '@moluoxixi/config-form-designer'
import { computed, nextTick } from 'vue'
import { PageManager } from './components'

const props = defineProps<PageManagerDialogProps>()

const emit = defineEmits<PageManagerDialogEmits>()

const dialogTitle = computed(() => createDesignerLocale(props.locale).t('pageManager.title', 'Pages'))

async function restoreCreationFocus(): Promise<void> {
  if (!props.returnFocusKey)
    return
  await nextTick()
  const target = document.querySelector<HTMLElement>(`[data-create-trigger="${props.returnFocusKey}"]`)
  if (!target)
    return
  target.focus()
  emit('returnFocusRestored')
}
</script>

<template>
  <ElDialog
    v-if="project"
    class="page-manager-dialog-shell"
    :model-value="open"
    :show-close="false"
    width="min(980px, calc(100vw - 24px))"
    append-to="#workbench-overlays"
    transition="none"
    @close="emit('close')"
    @opened="restoreCreationFocus"
  >
    <template #header="{ titleId }">
      <span :id="titleId" class="sr-only">{{ dialogTitle }}</span>
    </template>
    <PageManager
      :project="project"
      :projects="projects"
      :busy="busy"
      :locale="locale"
      @close="emit('close')"
      @create-page="emit('createPage')"
      @create-project="emit('createProject')"
      @open-project="emit('openProject', $event)"
      @action="emit('action', $event)"
    />
  </ElDialog>
</template>
