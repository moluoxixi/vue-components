<script setup lang="ts">
import { ArrowLeft, MessageSquare } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import WorkbenchCommandHint from '../../../components/WorkbenchCommandHint/index.vue'
import { useWorkbenchController } from '../../composables'
import { projectsPath } from '../../navigation'
import { ProjectWorkspaceNavigation } from './ProjectWorkspaceHeader/components'

const props = defineProps<{ projectId: string, projectName: string }>()
const router = useRouter()
const controller = useWorkbenchController()
const assistantReason = computed(() => controller.busy.value ? controller.workbenchLocale.value.t('action.processing', 'Wait for the current operation to finish.') : controller.dirty.value || controller.configError.value ? controller.workbenchLocale.value.t('assistant.saveFirst', 'Save or resolve the current draft before opening AI editing.') : undefined)
</script>

<template>
  <header class="project-workspace-header">
    <div class="project-workspace-header__heading">
      <ElButton text circle :title="controller.workbenchLocale.value.t('pageManager.backToProjects', 'Back to projects')" :aria-label="controller.workbenchLocale.value.t('pageManager.backToProjects', 'Back to projects')" @click="router.push(projectsPath())">
        <ArrowLeft :size="17" aria-hidden="true" />
      </ElButton>
      <h1 :title="props.projectName">
        {{ props.projectName }}
      </h1>
    </div>
    <ProjectWorkspaceNavigation class="project-workspace-header__navigation" :project-id="props.projectId" />
    <div v-if="$slots.summary" class="project-workspace-header__summary">
      <slot name="summary" />
    </div>
    <div v-if="$slots.status" class="project-workspace-header__status">
      <slot name="status" />
    </div>
    <div v-if="$slots.actions || controller.storageInfo.value.mode === 'local'" class="project-workspace-header__actions">
      <WorkbenchCommandHint v-if="controller.storageInfo.value.mode === 'local'" detached :label="controller.workbenchLocale.value.t('assistant.edit', 'Edit with AI')" :disabled-reason="assistantReason">
        <ElButton :disabled="Boolean(assistantReason)" @click="router.push({ path: '/assistant/new', query: { projectId: props.projectId } })">
          <MessageSquare :size="16" />{{ controller.workbenchLocale.value.t('assistant.edit', 'Edit with AI') }}
        </ElButton>
      </WorkbenchCommandHint>
      <slot name="actions" />
    </div>
  </header>
</template>

<style src="./ProjectWorkspaceHeader/style/index.css" scoped />
