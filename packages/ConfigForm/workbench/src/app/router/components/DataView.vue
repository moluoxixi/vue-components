<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AssetManagerWorkspace } from '../../../features/assets'
import { useAssetDraftGuard, useWorkbenchController, useWorkbenchUiStore } from '../../composables'
import { pageDesignPath, readWorkbenchRouteTarget } from '../../navigation'
import ManagementShell from './ManagementShell.vue'
import ProjectWorkspaceHeader from './ProjectWorkspaceHeader.vue'

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
const saveState = computed(() => editor.value?.hasChanges ? locale.value.t('data.draftHint', 'Unsaved draft · save to apply it') : controller.statusLabel.value)

useAssetDraftGuard({ editor: () => editor.value, locale })
</script>

<template>
  <ManagementShell :palette="ui.paletteFamily.value" :theme="ui.resolvedTheme.value">
    <main v-if="project" class="project-data-page" :aria-label="locale.t('data.title', 'Data management')" data-project-data>
      <ProjectWorkspaceHeader :project-id="project.id" :project-name="project.name">
        <template #actions>
          <ElButton v-if="designPath" :title="locale.t('data.backToDesign', 'Return to designer')" :aria-label="locale.t('data.backToDesign', 'Return to designer')" @click="router.push(designPath)">
            <ArrowLeft :size="15" aria-hidden="true" /><span class="project-data-back-label">{{ locale.t('data.backToDesign', 'Return to designer') }}</span>
          </ElButton>
        </template>
        <template #summary>
          <span>{{ locale.t('assets.datasets', 'Datasets') }} <strong>{{ project.datasetOrder.length }}</strong></span>
          <span>{{ locale.t('assets.resources', 'Resources') }} <strong>{{ Object.keys(project.resources).length }}</strong></span>
        </template>
        <template #status>
          <span class="project-data-save-state" role="status" :title="saveState">{{ saveState }}</span>
        </template>
      </ProjectWorkspaceHeader>
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
