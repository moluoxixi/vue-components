<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ProjectCreationWorkspace } from '../../components'
import { useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { projectPagesPath, projectsPath } from '../../navigation'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()

function close(): void {
  const path = ui.creationOrigin.value?.path ?? projectsPath()
  ui.clearCreationOrigin()
  void router.push(path)
}

async function created(): Promise<void> {
  const projectId = controller.currentProject.value?.id
  ui.clearCreationOrigin()
  await router.push(projectId ? projectPagesPath(projectId) : projectsPath())
}
</script>

<template>
  <ProjectCreationWorkspace
    :can-close="true"
    :locale="controller.localeOptions.value"
    @close="close"
    @created="created"
    @toggle-locale="ui.toggleLocale"
  />
</template>
