<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useCreationReturnFocus, useWorkbenchController, useWorkbenchManagementNav, useWorkbenchUiStore } from '../composables'
import { ProjectManager } from '../../features/projects'
import { projectCreatePath, projectPagesPath } from '../router'
import ManagementShell from './ManagementShell.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const nav = useWorkbenchManagementNav()

useCreationReturnFocus()

function createProject(mode: 'json' | 'template'): void {
  ui.setCreationOrigin({
    focusKey: mode === 'json' ? 'project-manager-import' : 'project-manager-create',
    path: router.currentRoute.value.fullPath,
  })
  void router.push(projectCreatePath(mode))
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
  </ManagementShell>
</template>
