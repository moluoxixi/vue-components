<script setup lang="ts">
import type { TemplateDetails } from '../../../features/templates'
import type { ProjectSurfaceAction } from '../../../project'
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SurfaceManagerPage } from '../../../features/pages'
import { createUserTemplateStore, downloadSurfaceTransfer, templateFromSurface } from '../../../project'
import { TemplateCreationWorkspace } from '../../components'
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
import ProjectWorkspaceNavigation from './ProjectWorkspaceNavigation.vue'
import TemplateDetailsDialog from './TemplateDetailsDialog.vue'

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
const templateSurfaceId = ref('')
const templateDetailsOpen = ref(false)
const savingTemplate = ref(false)
const templateError = ref('')
const templateSaved = ref(false)

useCreationReturnFocus()

function openPage(pageId: string): void {
  const projectId = project.value?.id
  if (projectId)
    void router.push(pageDesignPath(projectId, pageId))
}

async function createSurface(kind: 'page' | 'dialog' | 'drawer' = 'page'): Promise<void> {
  if (!project.value || controller.busy.value)
    return
  if (await controller.createSurface(kind))
    await createdPage()
}

function useTemplate(): void {
  const projectId = project.value?.id
  if (!projectId)
    return
  pageCreationKind.value = 'page'
  pageCreationOpen.value = true
  ui.setCreationOrigin({
    focusKey: 'page-manager-template',
    path: router.currentRoute.value.fullPath,
  })
}

function saveTemplate(surfaceId: string): void {
  templateSurfaceId.value = surfaceId
  templateError.value = ''
  templateDetailsOpen.value = true
}

async function confirmSaveTemplate(details: TemplateDetails): Promise<void> {
  const document = project.value
  const surface = document?.surfacesById[templateSurfaceId.value]
  if (!document || !surface || savingTemplate.value)
    return
  const store = createUserTemplateStore()
  savingTemplate.value = true
  try {
    await store.put(templateFromSurface({
      surface,
      registryLock: document.registryLock,
      name: details.name,
      description: details.description,
    }))
    templateDetailsOpen.value = false
    templateSaved.value = true
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    templateError.value = reason.includes('identity reference')
      ? controller.workbenchLocale.value.t('library.independentRequired', 'Templates need independent fields and options. Remove references to other pages, datasets, or resources before saving.')
      : controller.workbenchLocale.value.t('library.saveFailed', 'Unable to save template: {reason}', { reason })
  }
  finally {
    savingTemplate.value = false
    store.close()
  }
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
      @use-template="useTemplate"
      @save-template="saveTemplate"
      @import-surface="importSurface"
      @export="exportPage"
      @export-source="exportPageSource"
      @open-page="openPage"
      @open-projects="openProjects"
    >
      <template #navigation>
        <ProjectWorkspaceNavigation :project-id="project.id" />
      </template>
    </SurfaceManagerPage>
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
      :title="controller.workbenchLocale.value.t('pages.fromTemplate', 'From template')"
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
        initial-mode="template"
        :locale="controller.localeOptions.value"
        :surface-kind="pageCreationKind"
        target="surface"
        @close="pageCreationOpen = false"
        @created="createdPage"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
    <TemplateDetailsDialog
      v-model="templateDetailsOpen"
      :busy="savingTemplate"
      :error="templateError"
      :initial-name="project?.surfacesById[templateSurfaceId]?.name"
      :locale="controller.localeOptions.value"
      @confirm="confirmSaveTemplate"
    />
    <ElAlert v-if="templateSaved" class="workbench-toast" type="success" :title="controller.workbenchLocale.value.t('library.saved', 'Template saved. Find it in Template management.')" show-icon closable role="status" @close="templateSaved = false" />
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
        initial-mode="json"
        :locale="controller.localeOptions.value"
        target="surface"
        @close="closePageImport"
        @created="importedPage"
        @toggle-locale="ui.toggleLocale"
      />
    </ElDialog>
  </ManagementShell>
</template>
