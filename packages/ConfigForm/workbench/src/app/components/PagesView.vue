<script setup lang="ts">
import type { ProjectSurfaceAction } from '../../project'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { SurfaceManagerPage } from '../../features/pages'
import {
  useCreationReturnFocus,
  useWorkbenchController,
  useWorkbenchManagementNav,
  useWorkbenchUiStore,
} from '../composables'
import {
  pageCreatePath,
  pageDesignPath,
  projectPagesPath,
  projectsPath,
} from '../router'
import ManagementShell from './ManagementShell.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const nav = useWorkbenchManagementNav()
const project = computed(() => controller.currentProject.value)

useCreationReturnFocus()

/** The designer of the workspace's current page, falling back to the page list. */
function currentPagePath(): string | undefined {
  const projectId = project.value?.id
  if (!projectId)
    return undefined
  const pageId = controller.currentSurfaceId.value
  return pageId ? pageDesignPath(projectId, pageId) : undefined
}

function closePages(): void {
  void router.push(currentPagePath() ?? projectsPath())
}

function openPage(pageId: string): void {
  const projectId = project.value?.id
  if (projectId)
    void router.push(pageDesignPath(projectId, pageId))
}

function createSurface(): void {
  const projectId = project.value?.id
  if (!projectId)
    return
  ui.setCreationOrigin({
    focusKey: 'page-manager-new-surface',
    path: router.currentRoute.value.fullPath,
  })
  void router.push(pageCreatePath(projectId))
}

/**
 * Switching project inside page management stays on this screen; the route only
 * changes its project segment.
 */
async function openProject(id: string): Promise<void> {
  await controller.requestOpenProject(id)
  if (controller.currentProject.value?.id === id)
    void router.replace(projectPagesPath(id))
}

function openProjects(): void {
  void router.push(projectsPath())
}

function runAction(action: ProjectSurfaceAction): void {
  void controller.handleSurfaceAction(action)
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
    <SurfaceManagerPage
      v-if="project"
      :busy="controller.busy.value"
      :locale="controller.localeOptions.value"
      :palette="ui.paletteFamily.value"
      :project="project"
      :projects="controller.projects.value"
      :theme="ui.resolvedTheme.value"
      @action="runAction"
      @close="closePages"
      @create-surface="createSurface"
      @open-page="openPage"
      @open-project="openProject"
      @open-projects="openProjects"
    />
    <main
      v-else
      class="page-manager-page"
      :data-theme="ui.resolvedTheme.value"
      :data-palette="ui.paletteFamily.value"
    >
      <p class="page-manager-page__state" role="status">
        {{ controller.workbenchLocale.value.t('status.loading', 'Loading') }}
      </p>
    </main>
  </ManagementShell>
</template>
