<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ProjectManager } from '../../../features/projects'
import { ProjectCreationWorkspace } from '../../components'
import { nextTick, ref, useTemplateRef } from 'vue'
import { useCreationReturnFocus, useWorkbenchController, useWorkbenchManagementNav, useWorkbenchUiStore } from '../../composables'
import { projectCreatePath, projectPagesPath } from '../../navigation'
import ManagementShell from './ManagementShell.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const nav = useWorkbenchManagementNav()
const projectCreationOpen = ref(false)
const projectCreation = useTemplateRef<{ focusName?: () => void }>('projectCreation')

useCreationReturnFocus()

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
    :active="nav.active.value"
    :locale="controller.localeOptions.value"
    :palette="ui.paletteFamily.value"
    :theme="ui.resolvedTheme.value"
    @select="nav.select"
  >
    <ProjectManager
      :controller="controller"
      :ui="ui"
      @create="createProject"
      @open="openCurrentProject"
    />
    <ElDialog
      v-model="projectCreationOpen"
      class="project-creation-dialog"
      width="min(520px, calc(100vw - 28px))"
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
