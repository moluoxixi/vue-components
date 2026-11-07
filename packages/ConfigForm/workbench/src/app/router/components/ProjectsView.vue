<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { ProjectManager } from '../../../features/projects'
import { ProjectCreationWorkspace, TemplateCreationWorkspace } from '../../components'
import { useCreationReturnFocus, useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { pageDesignPath, projectCreatePath, projectPagesPath } from '../../navigation'
import ManagementShell from './ManagementShell.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const projectCreationOpen = ref(false)
const quickCreationOpen = ref(false)
const projectCreation = useTemplateRef<{ focusName?: () => void }>('projectCreation')

useCreationReturnFocus()

function createForm(): void {
  ui.clearMessage()
  quickCreationOpen.value = true
}

function createProject(mode: 'json' | 'template'): void {
  if (mode === 'template') {
    ui.clearMessage()
    projectCreationOpen.value = true
    return
  }
  ui.setCreationOrigin({
    focusKey: 'project-manager-import',
    path: router.currentRoute.value.fullPath,
  })
  void router.push(projectCreatePath(mode))
}

async function openCreatedProject(): Promise<void> {
  projectCreationOpen.value = false
  await nextTick()
  const projectId = controller.currentProject.value?.id
  if (projectId)
    await router.push(projectPagesPath(projectId))
}

async function openCreatedForm(): Promise<void> {
  quickCreationOpen.value = false
  const projectId = controller.currentProject.value?.id
  const surfaceId = controller.currentSurfaceId.value
  if (projectId)
    await router.push(surfaceId ? pageDesignPath(projectId, surfaceId) : projectPagesPath(projectId))
}

function closeProjectCreation(done: () => void): void {
  if (controller.busy.value)
    return
  done()
}

/** Entering a project starts at its page management screen. */
function openCurrentProject(): void {
  const projectId = controller.currentProject.value?.id
  if (!projectId)
    return
  void router.push(projectPagesPath(projectId))
}
</script>

<template>
  <ManagementShell
    :palette="ui.paletteFamily.value"
    :theme="ui.resolvedTheme.value"
  >
    <ProjectManager
      :controller="controller"
      :ui="ui"
      @create="createProject"
      @quick-create="createForm"
      @assistant="router.push('/assistant/new')"
      @open="openCurrentProject"
    />
    <ElDialog
      v-model="quickCreationOpen"
      class="page-creation-dialog quick-form-dialog"
      width="min(1180px, calc(var(--wb-viewport-width) - 2rem))"
      top="1rem"
      append-to="#workbench-overlays"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!controller.busy.value"
      :show-close="!controller.busy.value"
      :before-close="closeProjectCreation"
      :title="controller.workbenchLocale.value.t('projects.quickForm', 'Create a form')"
    >
      <TemplateCreationWorkspace
        :can-close="true"
        :locale="controller.localeOptions.value"
        initial-mode="template"
        target="project"
        quick-start
        @close="quickCreationOpen = false"
        @created="openCreatedForm"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
    <ElDialog
      v-model="projectCreationOpen"
      class="project-creation-dialog"
      width="min(520px, calc(var(--wb-viewport-width) - 2rem))"
      align-center
      append-to="#workbench-overlays"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!controller.busy.value"
      :show-close="!controller.busy.value"
      :before-close="closeProjectCreation"
      :title="controller.workbenchLocale.value.t('projectCreate.title', 'Create project')"
      @opened="projectCreation?.focusName?.()"
    >
      <ProjectCreationWorkspace
        ref="projectCreation"
        :can-close="true"
        :embedded="true"
        :locale="controller.localeOptions.value"
        @close="projectCreationOpen = false"
        @created="openCreatedProject"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
  </ManagementShell>
</template>
