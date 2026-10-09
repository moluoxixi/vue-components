<script setup lang="ts">
import { FolderKanban, LibraryBig } from '@lucide/vue'
import { useWorkbenchController } from '../../composables'
import { projectsPath, templatesPath } from '../../navigation'

const props = defineProps<{
  palette: string
  theme: string
}>()
const controller = useWorkbenchController()
</script>

<template>
  <div class="management-shell" :data-palette="props.palette" :data-theme="props.theme">
    <nav class="management-navigation" :aria-label="controller.workbenchLocale.value.t('management.navigation', 'Workspace navigation')">
      <span class="management-navigation__brand">ConfigForm</span>
      <RouterLink :to="projectsPath()" :class="{ 'is-active': $route.path.startsWith('/projects') }" :aria-current="$route.path.startsWith('/projects') ? 'page' : undefined">
        <FolderKanban :size="17" aria-hidden="true" />{{ controller.workbenchLocale.value.t('management.projects', 'Project management') }}
      </RouterLink>
      <RouterLink :to="templatesPath()" :class="{ 'is-active': $route.path.startsWith('/templates') }" :aria-current="$route.path.startsWith('/templates') ? 'page' : undefined">
        <LibraryBig :size="17" aria-hidden="true" />{{ controller.workbenchLocale.value.t('management.templates', 'Template management') }}
      </RouterLink>
    </nav>
    <div class="management-shell__content">
      <slot />
    </div>
  </div>
</template>
