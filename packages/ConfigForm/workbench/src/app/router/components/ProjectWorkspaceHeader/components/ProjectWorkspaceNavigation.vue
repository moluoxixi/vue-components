<script setup lang="ts">
import { Database, Files } from '@lucide/vue'
import { useWorkbenchController } from '../../../../composables'
import { projectDataPath, projectPagesPath } from '../../../../navigation'

defineProps<{ projectId: string }>()
const controller = useWorkbenchController()
</script>

<template>
  <nav class="project-workspace-navigation" :aria-label="controller.workbenchLocale.value.t('data.projectNavigation', 'Project workspace')">
    <RouterLink :to="projectPagesPath(projectId)" :aria-current="$route.name === 'project-pages' ? 'page' : undefined">
      <Files :size="16" aria-hidden="true" />{{ controller.workbenchLocale.value.t('pages.manage', 'Manage pages') }}
    </RouterLink>
    <RouterLink :to="projectDataPath(projectId)" :aria-current="$route.name === 'project-data' ? 'page' : undefined">
      <Database :size="16" aria-hidden="true" />{{ controller.workbenchLocale.value.t('assets.manage', 'Manage data') }}
    </RouterLink>
  </nav>
</template>

<style src="./ProjectWorkspaceNavigation/style/index.css" scoped />
