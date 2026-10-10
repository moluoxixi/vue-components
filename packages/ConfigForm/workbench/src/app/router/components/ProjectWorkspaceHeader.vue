<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useWorkbenchController } from '../../composables'
import { projectsPath } from '../../navigation'
import { ProjectWorkspaceNavigation } from './ProjectWorkspaceHeader/components'

defineProps<{ projectId: string, projectName: string }>()
const router = useRouter()
const controller = useWorkbenchController()
</script>

<template>
  <header class="project-workspace-header">
    <div class="project-workspace-header__heading">
      <ElButton text circle :title="controller.workbenchLocale.value.t('pageManager.backToProjects', 'Back to projects')" :aria-label="controller.workbenchLocale.value.t('pageManager.backToProjects', 'Back to projects')" @click="router.push(projectsPath())">
        <ArrowLeft :size="17" aria-hidden="true" />
      </ElButton>
      <h1 :title="projectName">
        {{ projectName }}
      </h1>
      <div v-if="$slots.actions" class="project-workspace-header__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="project-workspace-header__context">
      <ProjectWorkspaceNavigation :project-id="projectId" />
      <div class="project-workspace-header__summary">
        <slot name="summary" />
      </div>
      <div v-if="$slots.status" class="project-workspace-header__status">
        <slot name="status" />
      </div>
    </div>
  </header>
</template>

<style src="./ProjectWorkspaceHeader/style/index.css" scoped />
