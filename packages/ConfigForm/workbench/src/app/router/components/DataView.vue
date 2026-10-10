<script setup lang="ts">
import { ArrowLeft, FolderKanban } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AssetManagerWorkspace } from '../../../features/assets'
import { useAssetDraftGuard, useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { pageDesignPath, projectsPath, readWorkbenchRouteTarget } from '../../navigation'
import ManagementShell from './ManagementShell.vue'
import ProjectWorkspaceNavigation from './ProjectWorkspaceNavigation.vue'

const controller = useWorkbenchController()
const ui = useWorkbenchUiStore()
const route = useRoute()
const router = useRouter()
const locale = controller.workbenchLocale
const editor = useTemplateRef<InstanceType<typeof AssetManagerWorkspace>>('editor')
const project = computed(() => {
  const current = controller.currentProject.value
  return current?.id === readWorkbenchRouteTarget(route).projectId ? current : undefined
})
const designPath = computed(() => {
  const id = controller.currentSurfaceId.value
  return project.value?.surfacesById[id] ? pageDesignPath(project.value.id, id) : undefined
})

useAssetDraftGuard({ editor: () => editor.value, locale })
</script>

<template>
  <ManagementShell :palette="ui.paletteFamily.value" :theme="ui.resolvedTheme.value">
    <main v-if="project" class="project-data-page" :aria-label="locale.t('data.title', 'Data management')" data-project-data>
      <header class="project-data-header">
        <nav class="project-data-breadcrumb" :aria-label="locale.t('pageManager.breadcrumb', 'Breadcrumb')">
          <ElButton text @click="router.push(projectsPath())">
            <FolderKanban :size="14" aria-hidden="true" />{{ locale.t('management.projects', 'Project management') }}
          </ElButton>
          <span aria-hidden="true">/</span>
          <span>{{ locale.t('data.title', 'Data management') }}</span>
        </nav>
        <div class="project-data-heading">
          <h1>{{ project.name }}</h1>
          <ElButton v-if="designPath" @click="router.push(designPath)">
            <ArrowLeft :size="15" aria-hidden="true" />{{ locale.t('data.backToDesign', 'Return to designer') }}
          </ElButton>
        </div>
        <div class="project-data-summary">
          <span>{{ locale.t('data.projectScope', 'Shared by all pages in this project') }}</span>
          <span>{{ locale.t('assets.datasets', 'Datasets') }} <strong>{{ project.datasetOrder.length }}</strong></span>
          <span>{{ locale.t('assets.resources', 'Resources') }} <strong>{{ Object.keys(project.resources).length }}</strong></span>
          <span class="project-data-save-state" role="status">{{ editor?.hasChanges ? locale.t('data.draftHint', 'Unsaved draft · save to apply it') : controller.statusLabel.value }}</span>
        </div>
        <ProjectWorkspaceNavigation :project-id="project.id" />
      </header>
      <AssetManagerWorkspace ref="editor" :key="project.id" fill :commands="controller" :locale="controller.localeOptions.value" :project="project" />
    </main>
    <main v-else class="project-data-state">
      <p role="status">
        {{ locale.t('status.loading', 'Loading') }}
      </p>
    </main>
  </ManagementShell>
</template>

<style src="./DataView/style/index.css" scoped />
