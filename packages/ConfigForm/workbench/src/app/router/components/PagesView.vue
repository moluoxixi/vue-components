<script setup lang="ts">
import type { ProjectSurfaceAction } from '../../../project'
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TemplateCreationWorkspace } from '../../components'
import { SurfaceManagerPage } from '../../../features/pages'
import { downloadSurfaceTransfer } from '../../../project'
import {
  useCreationReturnFocus,
  useWorkbenchController,
  useWorkbenchUiStore,
} from '../../composables'
import {
  pageDesignPath,
  projectsPath,
  readWorkbenchRouteTarget,
} from '../../navigation'
import ManagementShell from './ManagementShell.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const router = useRouter()
const route = useRoute()
// While route sync opens a project, never display the previous project's pages.
const project = computed(() => {
  const current = controller.currentProject.value
  return current?.id === readWorkbenchRouteTarget(route).projectId ? current : undefined
})
const pageCreationOpen = ref(false)
const pageImportOpen = ref(false)
const pageCreationKind = ref<'page' | 'dialog' | 'drawer'>('page')

useCreationReturnFocus()

function openPage(pageId: string): void {
  const projectId = project.value?.id
  if (projectId)
    void router.push(pageDesignPath(projectId, pageId))
}

function createSurface(): void {
  const projectId = project.value?.id
  if (!projectId)
    return
  pageCreationKind.value = 'page'
  pageCreationOpen.value = true
  ui.setCreationOrigin({
    focusKey: 'page-manager-new-surface',
    path: router.currentRoute.value.fullPath,
  })
}

function importSurface(): void {
  if (!project.value)
    return
  pageImportOpen.value = true
  ui.setCreationOrigin({
    focusKey: 'page-manager-import-surface',
    path: router.currentRoute.value.fullPath,
  })
}

async function createdPage(): Promise<void> {
  pageCreationOpen.value = false
  ui.clearCreationOrigin()
  await nextTick()
  const projectId = project.value?.id
  const surfaceId = controller.currentSurfaceId.value
  if (projectId && surfaceId) {
    await router.push(pageDesignPath(projectId, surfaceId))
    await nextTick()
    document.querySelector<HTMLElement>('[data-designer-entry]')?.focus()
  }
}

function closePageImport(): void {
  pageImportOpen.value = false
  ui.clearCreationOrigin()
}

async function importedPage(): Promise<void> {
  pageImportOpen.value = false
  ui.clearCreationOrigin()
  await nextTick()
  const projectId = project.value?.id
  const surfaceId = controller.currentSurfaceId.value
  if (projectId && surfaceId)
    await router.push(pageDesignPath(projectId, surfaceId))
}

function openProjects(): void {
  void router.push(projectsPath())
}

function runAction(action: ProjectSurfaceAction): void {
  void controller.handleSurfaceAction(action)
}

async function exportPage(surfaceId: string): Promise<void> {
  const document = project.value
  if (!document)
    return
  try {
    const filename = await downloadSurfaceTransfer({
      document,
      readEmbedded: input => controller.readEmbeddedResource(input),
      surfaceId,
    })
    ui.showNotice({
      message: controller.workbenchLocale.value.t('export.downloaded', 'Downloaded {name}', { name: filename }),
      tone: 'success',
    })
  }
  catch (error) {
    ui.notify(error)
  }
}

async function exportPageSource(surfaceId: string): Promise<void> {
  await controller.exportSurfaceSource(surfaceId)
}
</script>

<template>
  <ManagementShell
    :palette="ui.paletteFamily.value"
    :theme="ui.resolvedTheme.value"
  >
    <SurfaceManagerPage
      v-if="project"
      :key="project.id"
      :busy="controller.busy.value"
      :locale="controller.localeOptions.value"
      :palette="ui.paletteFamily.value"
      :project="project"
      :theme="ui.resolvedTheme.value"
      @action="runAction"
      @create-surface="createSurface"
      @import-surface="importSurface"
      @export="exportPage"
      @export-source="exportPageSource"
      @open-page="openPage"
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
    <ElDialog
      v-model="pageCreationOpen"
      class="page-creation-dialog"
      width="min(1180px, calc(100vw - 28px))"
      top="3vh"
      append-to="#workbench-overlays"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!controller.busy.value"
      :show-close="!controller.busy.value"
      :title="controller.workbenchLocale.value.t('pages.createTitle', 'Create page')"
    >
      <div class="page-creation-dialog__toolbar">
        <span>{{ controller.workbenchLocale.value.t('pages.kindLabel', 'Page type') }}</span>
        <ElSegmented
          v-model="pageCreationKind"
          :disabled="controller.busy.value"
          :options="[
            { label: controller.workbenchLocale.value.t('pages.kind.form', 'Form'), value: 'page' },
            { label: controller.workbenchLocale.value.t('pages.kind.dialog', 'Dialog'), value: 'dialog' },
            { label: controller.workbenchLocale.value.t('pages.kind.drawer', 'Drawer'), value: 'drawer' },
          ]"
          :aria-label="controller.workbenchLocale.value.t('pages.kindLabel', 'Page type')"
        />
      </div>
      <TemplateCreationWorkspace
        :can-close="true"
        :initial-mode="'template'"
        :locale="controller.localeOptions.value"
        :surface-kind="pageCreationKind"
        :target="'surface'"
        @close="pageCreationOpen = false"
        @created="createdPage"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
    <ElDialog
      v-model="pageImportOpen"
      class="page-creation-dialog"
      width="min(1180px, calc(100vw - 28px))"
      top="3vh"
      append-to="#workbench-overlays"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!controller.busy.value"
      :show-close="!controller.busy.value"
      :title="controller.workbenchLocale.value.t('pages.importTitle', 'Import page')"
    >
      <TemplateCreationWorkspace
        :can-close="true"
        :initial-mode="'json'"
        :locale="controller.localeOptions.value"
        :target="'surface'"
        @close="closePageImport"
        @created="importedPage"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
  </ManagementShell>
</template>
